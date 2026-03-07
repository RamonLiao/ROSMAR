import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VaultExpiryJob {
  private readonly logger = new Logger(VaultExpiryJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async archiveExpired() {
    const result = await this.prisma.vaultSecret.deleteMany({
      where: {
        expiresAt: { not: null, lte: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Archived ${result.count} expired vault secrets`);
    }
  }
}
