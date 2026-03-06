import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import { DiscordService } from './discord.service';
import { TelegramService } from './telegram.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly emailService: EmailService,
    private readonly discordService: DiscordService,
    private readonly telegramService: TelegramService,
    private readonly notificationService: NotificationService,
  ) {}

  async sendMessage(workspaceId: string, body: any): Promise<any> {
    const { channel, ...dto } = body;

    let result: any;
    switch (channel) {
      case 'email':
        result = await this.emailService.sendMessage(workspaceId, dto);
        break;
      case 'discord':
        result = await this.discordService.sendMessage(workspaceId, dto);
        break;
      case 'telegram':
        result = await this.telegramService.sendMessage(workspaceId, dto);
        break;
      default:
        throw new Error(`Unknown messaging channel: ${channel}`);
    }

    this.notificationService.create({
      workspaceId,
      userId: dto.profileId ?? 'system',
      type: 'message_sent',
      title: `Message sent via ${channel}`,
      metadata: { channel, messageId: result?.messageId },
    }).catch(() => {});

    return result;
  }
}
