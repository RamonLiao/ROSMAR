// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from '../blockchain/sui.client';
import { Pool } from 'pg';

@Injectable()
export class SyncOnchainJob {
  private queue: Queue;
  private worker: Worker;
  private pgPool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly suiClient: SuiClientService,
  ) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    // TODO: Initialize BullMQ queue with repeat pattern
    // const redisUrl = this.configService.get<string>('REDIS_URL');
    // this.queue = new Queue('sync-onchain', {
    //   connection: { url: redisUrl },
    // });
    //
    // // Schedule recurring sync every 30 minutes
    // this.queue.add('sync', {}, {
    //   repeat: { pattern: '*/30 * * * *' },
    // });
    //
    // this.worker = new Worker('sync-onchain', async (job) => {
    //   await this.syncWorkspaceState();
    // }, {
    //   connection: { url: redisUrl },
    // });
  }

  private async syncWorkspaceState(): Promise<void> {
    console.log('Syncing on-chain state to PostgreSQL...');

    // Get all workspaces to sync
    const workspaces = await this.pgPool.query(
      `SELECT id, onchain_workspace_id FROM workspaces WHERE onchain_workspace_id IS NOT NULL LIMIT 10`,
    );

    for (const workspace of workspaces.rows) {
      await this.syncWorkspace(workspace.id, workspace.onchain_workspace_id);
    }
  }

  private async syncWorkspace(workspaceId: string, onchainId: string): Promise<void> {
    console.log(`Syncing workspace ${workspaceId} from on-chain object ${onchainId}`);

    // Fetch workspace object from Sui
    const workspaceObj = await this.suiClient.getObject(onchainId);

    if (!workspaceObj.data) {
      console.error(`Workspace object ${onchainId} not found on-chain`);
      return;
    }

    const fields = workspaceObj.data.content?.fields;

    // Sync workspace metadata
    await this.pgPool.query(
      `UPDATE workspaces
       SET name = $1, member_count = $2, synced_at = now()
       WHERE id = $3`,
      [fields?.name, fields?.member_count || 0, workspaceId],
    );

    // Sync member list
    const members = fields?.members || [];
    for (const member of members) {
      await this.pgPool.query(
        `INSERT INTO workspace_members (workspace_id, address, role, permissions, joined_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (workspace_id, address) DO UPDATE
         SET role = $3, permissions = $4`,
        [workspaceId, member.address, member.role, member.permissions],
      );
    }

    console.log(`Workspace ${workspaceId} synced successfully`);
  }
}
