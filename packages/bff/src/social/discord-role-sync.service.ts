import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface DiscordMember {
  user?: { id: string };
  roles: string[];
}

interface DiscordRole {
  id: string;
  name: string;
  position: number;
}

@Injectable()
export class DiscordRoleSyncService {
  private readonly logger = new Logger(DiscordRoleSyncService.name);
  private readonly botToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.botToken = this.config.get<string>('DISCORD_BOT_TOKEN', '');
  }

  /** Sync Discord roles for all profiles in a workspace */
  async syncWorkspace(workspaceId: string): Promise<{ synced: number; skipped: number }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { discordGuildId: true },
    });

    if (!workspace?.discordGuildId) {
      this.logger.debug(`Workspace ${workspaceId} has no discordGuildId, skipping`);
      return { synced: 0, skipped: 0 };
    }

    if (!this.botToken) {
      this.logger.warn('DISCORD_BOT_TOKEN not configured, skipping role sync');
      return { synced: 0, skipped: 0 };
    }

    const guildId = workspace.discordGuildId;

    // Fetch all guild roles (for name resolution)
    const guildRoles = await this.fetchGuildRoles(guildId);
    const roleNames: Record<string, string> = {};
    for (const r of guildRoles) {
      roleNames[r.id] = r.name;
    }

    // Get all profiles with Discord social links in this workspace
    const socialLinks = await this.prisma.socialLink.findMany({
      where: {
        platform: 'discord',
        profile: { workspaceId, isArchived: false },
      },
      select: { id: true, platformUserId: true },
    });

    let synced = 0;
    let skipped = 0;

    // Per-member lookup (no GUILD_MEMBERS privileged intent needed)
    const batchSize = 20;
    for (let i = 0; i < socialLinks.length; i += batchSize) {
      const batch = socialLinks.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (link) => {
          const member = await this.fetchGuildMember(guildId, link.platformUserId);
          const metadata = member
            ? { roles: member.roles, roleNames, syncedAt: new Date().toISOString() }
            : { roles: [], roleNames: {}, syncedAt: new Date().toISOString() };

          await this.prisma.socialLink.update({
            where: { id: link.id },
            data: { metadata },
          });

          return !!member;
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value) synced++;
          else skipped++;
        } else {
          skipped++;
          this.logger.warn(`Discord member fetch failed: ${r.reason}`);
        }
      }

      if (i + batchSize < socialLinks.length) {
        await this.delay(1000);
      }
    }

    this.logger.log(`Guild ${guildId}: ${synced} synced, ${skipped} not found in guild`);
    return { synced, skipped };
  }

  /** Fetch a single guild member by user ID. Returns null if not found (404). */
  private async fetchGuildMember(guildId: string, userId: string): Promise<DiscordMember | null> {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
    const res = await this.discordFetch(url);

    if (res.status === 404) return null;

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '5');
      this.logger.warn(`Rate limited, retrying after ${retryAfter}s`);
      await this.delay(retryAfter * 1000);
      return this.fetchGuildMember(guildId, userId);
    }

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }

  /** Fetch guild roles */
  async fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    const res = await this.discordFetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch guild roles: ${res.status}`);
    }

    return res.json();
  }

  private discordFetch(url: string): Promise<Response> {
    return fetch(url, {
      headers: { Authorization: `Bot ${this.botToken}` },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
