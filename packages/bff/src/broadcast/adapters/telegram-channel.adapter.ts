import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter } from './channel-adapter.interface';

@Injectable()
export class TelegramChannelAdapter implements ChannelAdapter {
  readonly channel = 'telegram';
  private readonly logger = new Logger(TelegramChannelAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(content: string, cfg: Record<string, any>): Promise<{ messageId: string }> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const chatId = cfg.chatId || this.config.get<string>('TELEGRAM_CHAT_ID');
    if (!chatId) throw new Error('Telegram chatId not provided');

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: content, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Telegram API error: ${err}`);
      throw new Error(`Telegram API error: ${res.status}`);
    }

    const data = await res.json();
    return { messageId: String(data.result?.message_id ?? '') };
  }
}
