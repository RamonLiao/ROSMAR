import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastService } from '../broadcast/broadcast.service';

@Injectable()
export class BroadcastSendJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastSendJob.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
  ) {}

  onModuleInit() {
    // Run every 60 seconds
    this.intervalRef = setInterval(() => {
      this.handleScheduledBroadcasts().catch((err) =>
        this.logger.error(`BroadcastSendJob error: ${err.message}`),
      );
    }, 60_000);
    this.logger.log('BroadcastSendJob started (every 60s)');
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async handleScheduledBroadcasts(): Promise<void> {
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
