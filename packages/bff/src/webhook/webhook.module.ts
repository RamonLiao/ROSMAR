import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WhaleAlertListener } from './whale-alert.listener';
import { EventIngestListener } from './event-ingest.listener';
import { NotificationModule } from '../notification/notification.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [NotificationModule, EngagementModule],
  controllers: [WebhookController],
  providers: [WebhookService, WhaleAlertListener, EventIngestListener],
  exports: [WebhookService],
})
export class WebhookModule {}
