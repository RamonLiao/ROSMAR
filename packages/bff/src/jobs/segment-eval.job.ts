import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RuleEvaluatorService } from '../segment/evaluator/rule-evaluator.service';

export interface SegmentEvalJobData {
  segmentId: string;
}

@Processor('segment-eval')
export class SegmentEvalJob extends WorkerHost {
  private readonly logger = new Logger(SegmentEvalJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEvaluator: RuleEvaluatorService,
  ) {
    super();
  }

  async process(job: Job<SegmentEvalJobData>): Promise<void> {
    const { segmentId } = job.data;
    this.logger.log(`Processing segment evaluation for ${segmentId}`);

    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId },
      select: { id: true, workspaceId: true, rules: true },
    });

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    const profileIds = await this.ruleEvaluator.evaluate(
      segment.workspaceId,
      segment.rules as any,
    );

    await this.prisma.segmentMembership.deleteMany({ where: { segmentId } });

    if (profileIds.length > 0) {
      await this.prisma.segmentMembership.createMany({
        data: profileIds.map((profileId) => ({ segmentId, profileId })),
        skipDuplicates: true,
      });
    }

    await this.prisma.segment.update({
      where: { id: segmentId },
      data: { lastRefreshedAt: new Date() },
    });

    this.logger.log(
      `Segment evaluation complete for ${segmentId}: ${profileIds.length} members`,
    );
  }
}
