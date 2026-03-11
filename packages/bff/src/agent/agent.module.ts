import { Module, forwardRef } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';
import { AgentController } from './agent.controller';
import { AnalystService } from './analyst/analyst.service';
import { AnalystController } from './analyst/analyst.controller';
import { ContentService } from './content/content.service';
import { ContentController } from './content/content.controller';
import { ActionService } from './action/action.service';
import { ActionController } from './action/action.controller';
import { YieldOptimizerService } from './yield/yield-optimizer.service';
import { YieldOptimizerController } from './yield/yield-optimizer.controller';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports: [forwardRef(() => CampaignModule)],
  controllers: [AgentController, AnalystController, ContentController, ActionController, YieldOptimizerController],
  providers: [
    LlmClientService,
    UsageTrackingService,
    AnalystService,
    ContentService,
    ActionService,
    YieldOptimizerService,
  ],
  exports: [LlmClientService, UsageTrackingService, AnalystService, YieldOptimizerService],
})
export class AgentModule {}
