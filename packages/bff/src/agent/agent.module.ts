import { Module, forwardRef } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';
import { ContentService } from './content/content.service';
import { ContentController } from './content/content.controller';
import { ActionService } from './action/action.service';
import { ActionController } from './action/action.controller';
import { CampaignModule } from '../campaign/campaign.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, forwardRef(() => CampaignModule)],
  controllers: [ContentController, ActionController],
  providers: [
    LlmClientService,
    UsageTrackingService,
    ContentService,
    ActionService,
  ],
  exports: [LlmClientService, UsageTrackingService],
})
export class AgentModule {}
