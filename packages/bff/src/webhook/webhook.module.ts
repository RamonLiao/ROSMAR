import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WhaleAlertListener } from './whale-alert.listener';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [WebhookController],
  providers: [WebhookService, WhaleAlertListener],
  exports: [WebhookService],
})
export class WebhookModule {}
