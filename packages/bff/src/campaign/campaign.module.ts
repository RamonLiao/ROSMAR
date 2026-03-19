import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { WorkflowEngine } from './workflow/workflow.engine';
import { SendTelegramAction } from './workflow/actions/send-telegram.action';
import { SendDiscordAction } from './workflow/actions/send-discord.action';
import { AirdropTokenAction } from './workflow/actions/airdrop-token.action';
import { GrantDiscordRoleAction } from './workflow/actions/grant-discord-role.action';
import { IssuePoapAction } from './workflow/actions/issue-poap.action';
import { AiGenerateContentAction } from './workflow/actions/ai-generate-content.action';
import { AssignQuestAction } from './workflow/actions/assign-quest.action';
import { SendEmailAction } from './workflow/actions/send-email.action';
import { AddToSegmentAction } from './workflow/actions/add-to-segment.action';
import { UpdateTierAction } from './workflow/actions/update-tier.action';
import { ConditionAction } from './workflow/actions/condition.action';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { TriggerMatcherService } from './trigger/trigger-matcher.service';
import { RecurringProcessor } from './trigger/recurring.processor';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { AgentModule } from '../agent/agent.module';
import { QuestModule } from '../quest/quest.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    AuthModule,
    NotificationModule,
    forwardRef(() => AgentModule),
    QuestModule,
    MessagingModule,
    BullModule.registerQueue({ name: 'workflow-delay' }),
    BullModule.registerQueue({ name: 'campaign-recurring' }),
  ],
  controllers: [CampaignController],
  providers: [
    CampaignService,
    WorkflowEngine,
    SendTelegramAction,
    SendDiscordAction,
    AirdropTokenAction,
    GrantDiscordRoleAction,
    IssuePoapAction,
    AiGenerateContentAction,
    AssignQuestAction,
    SendEmailAction,
    AddToSegmentAction,
    UpdateTierAction,
    ConditionAction,
    TriggerMatcherService,
    RecurringProcessor,
    SuiClientService,
    TxBuilderService,
  ],
  exports: [CampaignService, WorkflowEngine],
})
export class CampaignModule {}
