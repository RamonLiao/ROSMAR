import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';

@Processor('sync-onchain')
export class SyncOnchainJob extends WorkerHost {
  private readonly logger = new Logger(SyncOnchainJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.syncWorkspaceState();
  }

  private async syncWorkspaceState(): Promise<void> {
    this.logger.log('Syncing on-chain state to PostgreSQL...');

    const workspaces = await this.prisma.workspace.findMany({
      where: { suiObjectId: { not: null } },
      select: { id: true, suiObjectId: true },
      take: 10,
    });

    for (const workspace of workspaces) {
      if (workspace.suiObjectId) {
        await this.syncWorkspace(workspace.id, workspace.suiObjectId);
      }
    }
  }

  private async syncWorkspace(
    workspaceId: string,
    onchainId: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing workspace ${workspaceId} from on-chain object ${onchainId}`,
    );

    const workspaceObj = await this.suiClient.getObject(onchainId);

    if (!workspaceObj.data) {
      this.logger.error(`Workspace object ${onchainId} not found on-chain`);
      return;
    }

    const content = workspaceObj.data.content as
      | { fields?: Record<string, unknown> }
      | undefined;
    const fields = content?.fields;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: fields?.name as string | undefined,
      },
    });

    this.logger.log(`Workspace ${workspaceId} synced successfully`);
  }
}
