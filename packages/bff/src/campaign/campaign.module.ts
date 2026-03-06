import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { WorkflowEngine } from './workflow/workflow.engine';
import { SendTelegramAction } from './workflow/actions/send-telegram.action';
import { SendDiscordAction } from './workflow/actions/send-discord.action';
import { AirdropTokenAction } from './workflow/actions/airdrop-token.action';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [CampaignController],
  providers: [
    CampaignService,
    WorkflowEngine,
    SendTelegramAction,
    SendDiscordAction,
    AirdropTokenAction,
    SuiClientService,
    TxBuilderService,
  ],
  exports: [CampaignService, WorkflowEngine],
})
export class CampaignModule {}
