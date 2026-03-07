import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';
import { AgentController } from './agent.controller';
import { AnalystService } from './analyst/analyst.service';
import { AnalystController } from './analyst/analyst.controller';

@Module({
  controllers: [AgentController, AnalystController],
  providers: [LlmClientService, UsageTrackingService, AnalystService],
  exports: [LlmClientService, UsageTrackingService, AnalystService],
})
export class AgentModule {}
