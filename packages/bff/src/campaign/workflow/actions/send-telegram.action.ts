import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendTelegramConfig {
  chatId?: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
}

@Injectable()
export class SendTelegramAction {
  private botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async execute(profileId: string, config: SendTelegramConfig): Promise<void> {
    // TODO: Integrate with Telegram Bot API
    console.log(`Sending Telegram message to profile ${profileId}`, config);

    // In production:
    // const chatId = config.chatId || await this.getChatIdForProfile(profileId);
    // await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     chat_id: chatId,
    //     text: config.message,
    //     parse_mode: config.parseMode || 'HTML',
    //   }),
    // });
  }
}
