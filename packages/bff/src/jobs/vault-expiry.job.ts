import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { SuiClientService } from '../blockchain/sui.client';
import { NotificationService } from '../notification/notification.service';

@Processor('vault-expiry')
export class VaultExpiryJob extends WorkerHost {
  private readonly logger = new Logger(VaultExpiryJob.name);
  private readonly isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txBuilder: TxBuilderService,
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    super();
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  async process(_job: Job): Promise<void> {
    await this.archiveExpired();
  }

  private async archiveExpired(): Promise<void> {
    const expired = await this.prisma.vaultSecret.findMany({
      where: { expiresAt: { not: null, lte: new Date() } },
      select: {
        id: true,
        suiObjectId: true,
        workspaceId: true,
        profileId: true,
        key: true,
      },
      take: 50,
    });

    if (expired.length === 0) return;

    for (const secret of expired) {
      try {
        // On-chain expiry enforcement
        if (secret.suiObjectId && !this.isDryRun) {
          const tx = this.txBuilder.buildEnforceVaultExpiryTx(
            secret.suiObjectId,
          );
          await this.suiClient.executeTransaction(tx);
        }

        // Delete from Prisma
        await this.prisma.vaultSecret.delete({ where: { id: secret.id } });

        // Notify owner
        await this.notificationService.create({
          workspaceId: secret.workspaceId,
          userId: secret.profileId,
          type: 'vault_expired',
          title: `Vault secret "${secret.key}" has expired and been removed`,
        });
      } catch (err) {
        this.logger.error(
          `Failed to expire vault secret ${secret.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Archived ${expired.length} expired vault secrets`);
  }
}
