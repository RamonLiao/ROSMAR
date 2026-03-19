import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SegmentEvalJobData } from './segment-eval.job';

@Processor('segment-refresh')
export class SegmentRefreshJob extends WorkerHost {
  private readonly logger = new Logger(SegmentRefreshJob.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('segment-eval') private readonly segmentEvalQueue: Queue,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running segment refresh job...');

    const segments = await this.prisma.segment.findMany({
      where: {},
      select: { id: true },
    });

    this.logger.log(`Fan-out: enqueueing ${segments.length} segment-eval jobs`);

    await this.segmentEvalQueue.addBulk(
      segments.map((s) => ({
        name: 'evaluate',
        data: { segmentId: s.id } satisfies SegmentEvalJobData,
      })),
    );
  }
}
