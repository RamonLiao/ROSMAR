import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScoreRecalcJob } from './score-recalc.job';
import { SegmentRefreshJob } from './segment-refresh.job';

@Module({
  providers: [JobsService, ScoreRecalcJob, SegmentRefreshJob],
  exports: [JobsService],
})
export class JobsModule {}
