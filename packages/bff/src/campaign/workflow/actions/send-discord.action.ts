import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendDiscordConfig {
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
export class SendDiscordAction {
  private readonly logger = new Logger(SendDiscordAction.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string, config: SendDiscordConfig): Promise<void> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: { discordWebhookUrl: true },
    });

    const webhookUrl = config.webhookUrl || profile.discordWebhookUrl;
    if (!webhookUrl) {
      throw new Error(`No Discord webhook URL for profile ${profileId}`);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: config.content,
        embeds: config.embeds || [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    this.logger.log(`Discord message sent to profile ${profileId}`);
  }
}
