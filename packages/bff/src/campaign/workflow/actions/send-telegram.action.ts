import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendTelegramConfig {
  chatId?: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
}

@Injectable()
export class SendTelegramAction {
  private readonly logger = new Logger(SendTelegramAction.name);
  private botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async execute(profileId: string, config: SendTelegramConfig): Promise<void> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: { telegramChatId: true, workspaceId: true },
    });

    const chatId = config.chatId || profile.telegramChatId;
    if (!chatId) {
      throw new Error(`No Telegram chat_id for profile ${profileId}`);
    }

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — skipping send');
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: config.message,
          parse_mode: config.parseMode || 'HTML',
        }),
      },
    );

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.logger.log(`Telegram message sent to ${chatId} (msg_id: ${result.result?.message_id})`);
  }
}
