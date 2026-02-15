import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  constructor(private readonly configService: ConfigService) {}

  async execute(profileId: string, config: SendDiscordConfig): Promise<void> {
    // TODO: Integrate with Discord Webhook API
    console.log(`Sending Discord message to profile ${profileId}`, config);

    // In production:
    // const webhookUrl = config.webhookUrl || await this.getWebhookForProfile(profileId);
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     content: config.content,
    //     embeds: config.embeds || [],
    //   }),
    // });
  }
}
