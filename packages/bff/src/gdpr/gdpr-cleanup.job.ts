import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GdprExecutorService } from './gdpr-executor.service';

@Injectable()
export class GdprCleanupJob implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: GdprExecutorService,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => this.run(), 86_400_000); // daily
  }

  onModuleDestroy() {
    clearInterval(this.interval);
  }

  async run() {
    const eligible = await this.prisma.profile.findMany({
      where: {
        gdprStatus: 'PENDING_DELETION',
        gdprScheduledAt: { lte: new Date() },
      },
    });
    for (const profile of eligible) {
      await this.executor.execute(profile.id);
    }
    return eligible.length;
  }
}
