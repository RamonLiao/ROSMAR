import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(workspaceId: string, dto: SendDiscordDto): Promise<any> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: dto.profileId },
      select: { discordWebhookUrl: true },
    });

    const webhookUrl = dto.webhookUrl || profile.discordWebhookUrl;
    if (!webhookUrl) {
      throw new Error('No Discord webhook URL linked to profile');
    }

    let externalId = `dc_mock_${Date.now()}`;
    let status = 'sent';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: dto.content,
          embeds: dto.embeds || [],
        }),
      });

      if (!response.ok) {
        status = 'failed';
        this.logger.error(`Discord webhook failed: ${response.status}`);
      }
    } catch (err: any) {
      status = 'failed';
      this.logger.error(`Discord send error: ${err.message}`);
    }

    await this.prisma.message.create({
      data: {
        workspaceId,
        profileId: dto.profileId,
        channel: 'discord',
        body: dto.content,
        status,
        externalId,
        sentAt: new Date(),
      },
    });

    return { messageId: externalId, webhookUrl, status };
  }
}
