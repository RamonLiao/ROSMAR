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

      // Vault records
      await tx.vaultSecret.deleteMany({ where: { profileId } });
      // VaultAccessLog has no profileId — delete via secretIds already removed above

      // Messages
      await tx.message.deleteMany({ where: { profileId } });

      // WorkflowActionLogs
      await tx.workflowActionLog.deleteMany({ where: { profileId } });

      // DealDocuments via deals
      const dealIds = await tx.deal.findMany({
        where: { profileId },
        select: { id: true },
      });
      if (dealIds.length > 0) {
        await tx.dealDocument.deleteMany({
          where: { dealId: { in: dealIds.map((d: { id: string }) => d.id) } },
        });
      }

      await tx.gdprDeletionLog.updateMany({
        where: { profileId, status: 'PENDING' },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });
    });
  }
}
