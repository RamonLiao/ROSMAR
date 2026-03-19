import { Module } from '@nestjs/common';
import { BullQueueModule } from './bull.module';
import { JobsService } from './jobs.service';
import { SegmentEvalJob } from './segment-eval.job';
import { SegmentRefreshJob } from './segment-refresh.job';
import { SegmentDiffJob } from './segment-diff.job';
import { CampaignSchedulerJob } from './campaign-scheduler.job';
import { SlaCheckerJob } from './sla-checker.job';
import { SyncOnchainJob } from './sync-onchain.job';
import { VaultExpiryJob } from './vault-expiry.job';
import { ScoreRecalcJob } from './score-recalc.job';
import { BroadcastSendJob } from './broadcast-send.job';
import { WorkflowDelayJob } from './workflow-delay.job';
import { TimeElapsedProcessor } from '../campaign/trigger/time-elapsed.processor';
import { BalanceSyncJob } from './balance-sync.job';
import { DiscordRoleSyncJob } from './discord-role-sync.job';
import { VaultReleaseJob } from './vault-release.job';
import { AutoTagModule } from '../auto-tag/auto-tag.module';
import { EngagementModule } from '../engagement/engagement.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { SegmentModule } from '../segment/segment.module';
import { CampaignModule } from '../campaign/campaign.module';
import { NotificationModule } from '../notification/notification.module';
import { SocialModule } from '../social/social.module';
import { BroadcastModule } from '../broadcast/broadcast.module';

@Module({
  imports: [BullQueueModule, AutoTagModule, EngagementModule, BlockchainModule, SegmentModule, CampaignModule, NotificationModule, SocialModule, BroadcastModule],
  providers: [
    JobsService,
    SegmentEvalJob,
    SegmentRefreshJob,
    SegmentDiffJob,
    CampaignSchedulerJob,
    SlaCheckerJob,
    SyncOnchainJob,
    VaultExpiryJob,
    ScoreRecalcJob,
    BroadcastSendJob,
    WorkflowDelayJob,
    TimeElapsedProcessor,
    BalanceSyncJob,
    DiscordRoleSyncJob,
    VaultReleaseJob,
  ],
  exports: [JobsService],
})
export class JobsModule {}
