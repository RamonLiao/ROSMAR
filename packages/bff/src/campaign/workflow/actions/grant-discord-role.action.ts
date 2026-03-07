import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GrantDiscordRoleConfig {
  guildId: string;
  roleId: string;
}

@Injectable()
export class GrantDiscordRoleAction {
  private readonly logger = new Logger(GrantDiscordRoleAction.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string, config: GrantDiscordRoleConfig): Promise<void> {
    // Lookup Discord social link for profile
    const link = await this.prisma.socialLink.findUnique({
      where: { profileId_platform: { profileId, platform: 'discord' } },
    });

    if (!link || !link.oauthTokenEncrypted) {
      throw new Error(`No Discord OAuth token for profile ${profileId}`);
    }

    // Get the Discord user ID from the social link
    const discordUserId = link.platformUserId;
    if (!discordUserId) {
      throw new Error(`No Discord user ID for profile ${profileId}`);
    }

    // Note: In production, decrypt the token via SocialLinkService.decryptToken()
    // For the workflow action, we use the Bot token (server-side) to assign roles
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      throw new Error('DISCORD_BOT_TOKEN not configured');
    }

    const url = `https://discord.com/api/v10/guilds/${config.guildId}/members/${discordUserId}/roles/${config.roleId}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Discord API failed: ${response.status} ${response.statusText} — ${body}`,
      );
    }

    this.logger.log(
      `Granted role ${config.roleId} to user ${discordUserId} in guild ${config.guildId}`,
    );
  }
}
