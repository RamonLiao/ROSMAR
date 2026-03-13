import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GdprExecutorService {
  private readonly logger = new Logger(GdprExecutorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Collect Seal policy IDs for audit before deletion
      const vaultSecrets = await tx.vaultSecret.findMany({
        where: { profileId },
        select: { sealPolicyId: true, walrusBlobId: true },
      });

      const sealPolicyIds = vaultSecrets
        .map((s: { sealPolicyId: string | null }) => s.sealPolicyId)
        .filter((id: string | null): id is string => !!id);

      if (sealPolicyIds.length > 0) {
        this.logger.log(
          `GDPR delete profile=${profileId}: orphaning ${sealPolicyIds.length} Seal policies: ${sealPolicyIds.join(', ')}`,
        );
      }

      // Also collect deal document Seal policies
      const dealIds = await tx.deal.findMany({
        where: { profileId },
        select: { id: true },
      });
      if (dealIds.length > 0) {
        const dealDocs = await tx.dealDocument.findMany({
          where: { dealId: { in: dealIds.map((d: { id: string }) => d.id) } },
          select: { sealPolicyId: true },
        });
        const dealPolicyIds = dealDocs
          .map((d: { sealPolicyId: string | null }) => d.sealPolicyId)
          .filter((id: string | null): id is string => !!id);
        if (dealPolicyIds.length > 0) {
          this.logger.log(
            `GDPR delete profile=${profileId}: orphaning ${dealPolicyIds.length} deal doc Seal policies: ${dealPolicyIds.join(', ')}`,
          );
        }
      }

      // Nullify PII
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

      // Vault records — encrypted data in Walrus becomes unreachable
      await tx.vaultSecret.deleteMany({ where: { profileId } });

      // Messages
      await tx.message.deleteMany({ where: { profileId } });

      // WorkflowActionLogs
      await tx.workflowActionLog.deleteMany({ where: { profileId } });

      // DealDocuments via deals
      if (dealIds.length > 0) {
        await tx.dealDocument.deleteMany({
          where: { dealId: { in: dealIds.map((d: { id: string }) => d.id) } },
        });
      }

      await tx.gdprDeletionLog.updateMany({
        where: { profileId, status: 'PENDING' },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
          metadata: {
            orphanedSealPolicies: sealPolicyIds,
          },
        },
      });
    });
  }
}
