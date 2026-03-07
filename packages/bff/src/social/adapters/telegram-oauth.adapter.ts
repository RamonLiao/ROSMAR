import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface TelegramLoginData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramUser {
  id: string;
  username: string | null;
}

@Injectable()
export class TelegramOAuthAdapter {
  private readonly botToken: string;

  constructor(private config: ConfigService) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', 'test-bot-token');
  }

  /**
   * Verify Telegram Login Widget data using HMAC-SHA256.
   * https://core.telegram.org/widgets/login#checking-authorization
   */
  verifyLoginWidget(data: TelegramLoginData): boolean {
    const { hash, ...rest } = data;

    // Check auth_date is not too old (allow 1 day)
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400) {
      return false;
    }

    // Build check string: key=value pairs sorted alphabetically, joined by \n
    const checkString = Object.entries(rest)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

    // Secret key = SHA256(bot_token)
    const secretKey = crypto.createHash('sha256').update(this.botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    return hmac === hash;
  }

  getUserInfo(data: TelegramLoginData): TelegramUser {
    return {
      id: String(data.id),
      username: data.username ?? null,
    };
  }
}
