import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';
import { AgentController } from './agent.controller';

@Module({
  controllers: [AgentController],
  providers: [LlmClientService, UsageTrackingService],
  exports: [LlmClientService, UsageTrackingService],
})
export class AgentModule {}
