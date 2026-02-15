import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import { DiscordService } from './discord.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly emailService: EmailService,
    private readonly discordService: DiscordService,
    private readonly telegramService: TelegramService,
  ) {}

  async sendMessage(workspaceId: string, body: any): Promise<any> {
    const { channel, ...dto } = body;

    switch (channel) {
      case 'email':
        return this.emailService.sendMessage(workspaceId, dto);
      case 'discord':
        return this.discordService.sendMessage(workspaceId, dto);
      case 'telegram':
        return this.telegramService.sendMessage(workspaceId, dto);
      default:
        throw new Error(`Unknown messaging channel: ${channel}`);
    }
  }
}
