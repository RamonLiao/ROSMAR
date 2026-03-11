import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('segment-refresh')
export class SegmentRefreshJob extends WorkerHost {
  private readonly logger = new Logger(SegmentRefreshJob.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running segment refresh job...');
    const segments = await this.prisma.segment.findMany({
      where: {},
      select: { id: true },
    });
    this.logger.log(`Found ${segments.length} segments to refresh`);
  }
}
