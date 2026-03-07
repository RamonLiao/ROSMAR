import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScoreRecalcJob } from './score-recalc.job';
import { SegmentRefreshJob } from './segment-refresh.job';
import { VaultExpiryJob } from './vault-expiry.job';

@Module({
  providers: [JobsService, ScoreRecalcJob, SegmentRefreshJob, VaultExpiryJob],
  exports: [JobsService],
})
export class JobsModule {}
