import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScoreRecalcJob } from './score-recalc.job';
import { SegmentRefreshJob } from './segment-refresh.job';
import { AutoTagModule } from '../auto-tag/auto-tag.module';

@Module({
  imports: [AutoTagModule],
  providers: [JobsService, ScoreRecalcJob, SegmentRefreshJob],
  exports: [JobsService],
})
export class JobsModule {}
