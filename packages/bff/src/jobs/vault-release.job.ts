import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Processor('vault-release')
export class VaultReleaseJob extends WorkerHost {
  private readonly logger = new Logger(VaultReleaseJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const due = await this.prisma.vaultSecret.findMany({
      where: {
        isReleased: false,
        releaseAt: { lte: new Date() },
      },
      take: 100,
    });

    if (due.length === 0) return;

    for (const secret of due) {
      try {
        await this.prisma.vaultSecret.update({
          where: { id: secret.id },
          data: { isReleased: true },
        });

        await this.prisma.vaultAccessLog.create({
          data: {
            workspaceId: secret.workspaceId,
            secretId: secret.id,
            actor: 'system',
            action: 'AUTO_RELEASE',
          },
        });

        await this.notificationService.create({
          workspaceId: secret.workspaceId,
          userId: secret.profileId,
          type: 'vault_release',
          title: `Secret "${secret.key}" has been released`,
          body: `The time-locked secret for profile ${secret.profileId} is now accessible.`,
          metadata: {
            secretId: secret.id,
            key: secret.key,
            profileId: secret.profileId,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to release vault secret ${secret.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Released ${due.length} time-locked vault secrets`);
  }
}
