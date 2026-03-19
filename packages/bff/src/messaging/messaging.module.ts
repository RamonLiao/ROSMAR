import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { DiscordService } from './discord.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [MessagingController],
  providers: [MessagingService, TelegramService, EmailService, DiscordService],
  exports: [MessagingService, EmailService],
})
export class MessagingModule {}
