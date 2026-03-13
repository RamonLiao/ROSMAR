import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordRoleSyncService } from '../social/discord-role-sync.service';

export interface DiscordRoleSyncJobData {
  workspaceId?: string;
}

@Processor('discord-role-sync')
export class DiscordRoleSyncJob extends WorkerHost {
  private readonly logger = new Logger(DiscordRoleSyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordRoleSyncService: DiscordRoleSyncService,
  ) {
    super();
  }

  async process(job: Job<DiscordRoleSyncJobData>): Promise<void> {
    this.logger.log('Running Discord role sync job...');

    let workspaceIds: string[];
    if (job.data.workspaceId) {
      workspaceIds = [job.data.workspaceId];
    } else {
      const workspaces = await this.prisma.workspace.findMany({
        where: { discordGuildId: { not: null } },
        select: { id: true },
      });
      workspaceIds = workspaces.map(w => w.id);
    }

    for (const wsId of workspaceIds) {
      try {
        await this.discordRoleSyncService.syncWorkspace(wsId);
      } catch (err) {
        this.logger.error(`Discord role sync failed for workspace ${wsId}: ${err}`);
      }
    }
  }
}
