import { Module } from '@nestjs/common';
import { WhaleAlertListener } from './whale-alert.listener';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [WhaleAlertListener],
})
export class WebhookModule {}
