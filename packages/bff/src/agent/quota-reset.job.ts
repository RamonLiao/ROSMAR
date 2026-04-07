import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuotaResetJob {
  private readonly logger = new Logger(QuotaResetJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 1 * *') // 1st of each month, 00:00 UTC
  async handleQuotaReset(): Promise<void> {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await this.prisma.workspaceAiConfig.updateMany({
      where: { quotaResetAt: { lte: now } },
      data: {
        usedQuotaUsd: 0,
        quotaResetAt: nextMonth,
      },
    });

    this.logger.log(`Quota reset complete: ${result.count} workspace(s) reset`);
  }
}
