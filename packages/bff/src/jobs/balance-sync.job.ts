import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceSyncService } from '../blockchain/balance-sync.service';

export interface BalanceSyncJobData {
  workspaceId?: string;
}

@Processor('balance-sync')
export class BalanceSyncJob extends WorkerHost {
  private readonly logger = new Logger(BalanceSyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceSyncService: BalanceSyncService,
  ) {
    super();
  }

  async process(job: Job<BalanceSyncJobData>): Promise<void> {
    this.logger.log('Running balance sync job...');

    let workspaceIds: string[];
    if (job.data.workspaceId) {
      workspaceIds = [job.data.workspaceId];
    } else {
      const workspaces = await this.prisma.workspace.findMany({
        select: { id: true },
      });
      workspaceIds = workspaces.map(w => w.id);
    }

    for (const wsId of workspaceIds) {
      try {
        const result = await this.balanceSyncService.syncWorkspace(wsId);
        this.logger.log(`Workspace ${wsId}: ${result.synced} synced, ${result.errors} errors`);
      } catch (err) {
        this.logger.error(`Balance sync failed for workspace ${wsId}: ${err}`);
      }
    }
  }
}
