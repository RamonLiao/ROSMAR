import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter } from './channel-adapter.interface';

@Injectable()
export class DiscordChannelAdapter implements ChannelAdapter {
  readonly channel = 'discord';
  private readonly logger = new Logger(DiscordChannelAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(content: string, cfg: Record<string, any>): Promise<{ messageId: string }> {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN');
    if (!token) throw new Error('DISCORD_BOT_TOKEN not configured');

    const channelId = cfg.channelId || this.config.get<string>('DISCORD_CHANNEL_ID');
    if (!channelId) throw new Error('Discord channelId not provided');

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Discord API error: ${err}`);
      throw new Error(`Discord API error: ${res.status}`);
    }

    const data = await res.json();
    return { messageId: data.id };
  }
}
