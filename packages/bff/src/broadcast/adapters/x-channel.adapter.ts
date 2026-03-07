import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter } from './channel-adapter.interface';

@Injectable()
export class XChannelAdapter implements ChannelAdapter {
  readonly channel = 'x';
  private readonly logger = new Logger(XChannelAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(content: string, _cfg: Record<string, any>): Promise<{ messageId: string }> {
    const token = this.config.get<string>('X_BEARER_TOKEN');
    if (!token) throw new Error('X_BEARER_TOKEN not configured');

    const url = 'https://api.x.com/2/tweets';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: content }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`X API error: ${err}`);
      throw new Error(`X API error: ${res.status}`);
    }

    const data = await res.json();
    return { messageId: data.data?.id ?? '' };
  }
}
