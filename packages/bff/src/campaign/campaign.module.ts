import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { WorkflowEngine } from './workflow/workflow.engine';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [CampaignController],
  providers: [CampaignService, WorkflowEngine, SuiClientService, TxBuilderService],
  exports: [CampaignService, WorkflowEngine],
})
export class CampaignModule {}
