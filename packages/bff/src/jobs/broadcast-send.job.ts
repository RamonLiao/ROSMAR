import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastService } from '../broadcast/broadcast.service';

export interface BroadcastSendJobData {
  broadcastId?: string;
}

@Processor('broadcast-send')
export class BroadcastSendJob extends WorkerHost {
  private readonly logger = new Logger(BroadcastSendJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
  ) {
    super();
  }

  async process(_job: Job<BroadcastSendJobData>): Promise<void> {
    await this.handleScheduledBroadcasts();
  }

  private async handleScheduledBroadcasts(): Promise<void> {
    const now = new Date();

    const broadcasts = await this.prisma.broadcast.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    });

    if (broadcasts.length === 0) return;

    this.logger.log(`Found ${broadcasts.length} scheduled broadcast(s) to send`);

    for (const broadcast of broadcasts) {
      try {
        await this.broadcastService.send(broadcast.id);
        this.logger.log(`Broadcast ${broadcast.id} sent successfully`);
      } catch (err: any) {
        this.logger.error(`Failed to send broadcast ${broadcast.id}: ${err.message}`);
        await this.prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { status: 'failed' },
        });
      }
    }
  }
}
