import { Injectable } from '@nestjs/common';
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
  private botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async sendMessage(workspaceId: string, dto: SendTelegramDto): Promise<any> {
    const chatId = dto.chatId || (await this.getChatIdForProfile(dto.profileId));

    // TODO: Send via Telegram Bot API
    console.log(`Sending Telegram message to ${chatId}:`, dto.message);

    // In production:
    // const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     chat_id: chatId,
    //     text: dto.message,
    //     parse_mode: dto.parseMode || 'HTML',
    //   }),
    // });
    //
    // const result = await response.json();
    // const messageId = result.result?.message_id;

    const messageId = `tg_${Date.now()}`;

    // Log to database
    await this.prisma.$executeRaw`
      INSERT INTO messages (
        workspace_id, profile_id, channel, body, status, external_id, sent_at
      ) VALUES (${workspaceId}, ${dto.profileId}, 'telegram', ${dto.message}, 'sent', ${messageId}, now())
    `;

    return {
      messageId,
      chatId,
      status: 'sent',
    };
  }

  private async getChatIdForProfile(profileId: string): Promise<string> {
    // TODO: Query profile's linked Telegram chat_id
    const result = await this.prisma.$queryRaw<Array<{ telegram_chat_id: string }>>`
      SELECT telegram_chat_id FROM profile_socials WHERE profile_id = ${profileId}
    `;

    if (result.length === 0 || !result[0].telegram_chat_id) {
      throw new Error('No Telegram chat_id linked to profile');
    }

    return result[0].telegram_chat_id;
  }
}
