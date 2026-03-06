import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendTelegramDto {
  profileId: string;
  chatId?: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async sendMessage(workspaceId: string, dto: SendTelegramDto): Promise<any> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: dto.profileId },
      select: { telegramChatId: true },
    });

    const chatId = dto.chatId || profile.telegramChatId;
    if (!chatId) {
      throw new Error('No Telegram chat_id linked to profile');
    }

    let externalId = `tg_mock_${Date.now()}`;
    let status = 'sent';

    if (this.botToken) {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: dto.message,
            parse_mode: dto.parseMode || 'HTML',
          }),
        },
      );

      const result = await response.json();
      if (!result.ok) {
        status = 'failed';
        this.logger.error(`Telegram API error: ${result.description}`);
      } else {
        externalId = String(result.result?.message_id);
      }
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — message logged but not sent');
    }

    // Log to database
    await this.prisma.message.create({
      data: {
        workspaceId,
        profileId: dto.profileId,
        channel: 'telegram',
        body: dto.message,
        status,
        externalId,
        sentAt: new Date(),
      },
    });

    return { messageId: externalId, chatId, status };
  }
}
