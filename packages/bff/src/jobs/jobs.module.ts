import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScoreRecalcJob } from './score-recalc.job';
import { SegmentRefreshJob } from './segment-refresh.job';
import { AutoTagModule } from '../auto-tag/auto-tag.module';
import { EngagementModule } from '../engagement/engagement.module';
import { VaultExpiryJob } from './vault-expiry.job';
import { SegmentDiffJob } from './segment-diff.job';
import { BroadcastSendJob } from './broadcast-send.job';
import { BroadcastModule } from '../broadcast/broadcast.module';

@Module({
  imports: [AutoTagModule, EngagementModule, BroadcastModule],
  providers: [JobsService, ScoreRecalcJob, SegmentRefreshJob, VaultExpiryJob, SegmentDiffJob, BroadcastSendJob],
  exports: [JobsService],
})
export class JobsModule {}
