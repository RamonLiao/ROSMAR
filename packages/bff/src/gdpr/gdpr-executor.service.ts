import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GdprExecutorService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: {
          email: null,
          phone: null,
          suinsName: null,
          telegramChatId: null,
          discordWebhookUrl: null,
          gdprStatus: 'COMPLETED',
          gdprCompletedAt: new Date(),
        },
      });
      await tx.socialLink.deleteMany({ where: { profileId } });
      await tx.segmentMembership.deleteMany({ where: { profileId } });
      await tx.gdprDeletionLog.updateMany({
        where: { profileId, status: 'PENDING' },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });
    });
  }
}
