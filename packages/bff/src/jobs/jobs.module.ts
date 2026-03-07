import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScoreRecalcJob } from './score-recalc.job';
import { SegmentRefreshJob } from './segment-refresh.job';
import { AutoTagModule } from '../auto-tag/auto-tag.module';
import { EngagementModule } from '../engagement/engagement.module';
import { VaultExpiryJob } from './vault-expiry.job';

@Module({
  imports: [AutoTagModule, EngagementModule],
  providers: [JobsService, ScoreRecalcJob, SegmentRefreshJob, VaultExpiryJob],
  exports: [JobsService],
})
export class JobsModule {}
