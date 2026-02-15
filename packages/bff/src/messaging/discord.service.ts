import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendDiscordDto {
  profileId: string;
  webhookUrl?: string;
  content: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  }>;
}

@Injectable()
export class DiscordService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(workspaceId: string, dto: SendDiscordDto): Promise<any> {
    const webhookUrl = dto.webhookUrl || (await this.getWebhookForProfile(dto.profileId));

    // TODO: Send via Discord Webhook API
    console.log(`Sending Discord message to ${webhookUrl}:`, dto.content);

    // In production:
    // const response = await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     content: dto.content,
    //     embeds: dto.embeds || [],
    //   }),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Discord webhook failed: ${response.statusText}`);
    // }

    const messageId = `dc_${Date.now()}`;

    // Log to database
    await this.prisma.$executeRaw`
      INSERT INTO messages (
        workspace_id, profile_id, channel, body, status, external_id, sent_at
      ) VALUES (${workspaceId}, ${dto.profileId}, 'discord', ${dto.content}, 'sent', ${messageId}, now())
    `;

    return {
      messageId,
      webhookUrl,
      status: 'sent',
    };
  }

  private async getWebhookForProfile(profileId: string): Promise<string> {
    // TODO: Query profile's linked Discord webhook URL
    const result = await this.prisma.$queryRaw<Array<{ discord_webhook_url: string }>>`
      SELECT discord_webhook_url FROM profile_socials WHERE profile_id = ${profileId}
    `;

    if (result.length === 0 || !result[0].discord_webhook_url) {
      throw new Error('No Discord webhook URL linked to profile');
    }

    return result[0].discord_webhook_url;
  }
}
