// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class CampaignSchedulerJob {
  private queue: Queue;
  private worker: Worker;
  private pgPool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    // TODO: Initialize BullMQ queue with repeat pattern
    // const redisUrl = this.configService.get<string>('REDIS_URL');
    // this.queue = new Queue('campaign-scheduler', {
    //   connection: { url: redisUrl },
    // });
    //
    // // Schedule recurring check every minute
    // this.queue.add('check-scheduled', {}, {
    //   repeat: { pattern: '*/1 * * * *' }, // Every minute
    // });
    //
    // this.worker = new Worker('campaign-scheduler', async (job) => {
    //   await this.checkScheduledCampaigns();
    // }, {
    //   connection: { url: redisUrl },
    // });
  }

  private async checkScheduledCampaigns(): Promise<void> {
    console.log('Checking for scheduled campaigns...');

    // Find campaigns with scheduled start time that haven't started yet
    const campaigns = await this.pgPool.query(
      `SELECT id, workflow_steps, segment_id
       FROM campaigns
       WHERE status = 'scheduled'
         AND scheduled_start_at <= now()
       LIMIT 10`,
    );

    for (const campaign of campaigns.rows) {
      await this.startCampaign(campaign.id, campaign.workflow_steps, campaign.segment_id);
    }
  }

  private async startCampaign(
    campaignId: string,
    workflowSteps: any[],
    segmentId: string,
  ): Promise<void> {
    console.log(`Starting campaign ${campaignId}`);

    // Get segment profiles
    const profiles = await this.pgPool.query(
      `SELECT profile_id FROM segment_memberships WHERE segment_id = $1`,
      [segmentId],
    );

    const profileIds = profiles.rows.map((r) => r.profile_id);

    // Update campaign status
    await this.pgPool.query(
      `UPDATE campaigns SET status = 'active', started_at = now() WHERE id = $1`,
      [campaignId],
    );

    // TODO: Trigger workflow engine for each profile
    // const workflowEngine = ...; // Inject WorkflowEngine
    // await workflowEngine.startWorkflow(campaignId, workflowSteps, profileIds);

    console.log(`Campaign ${campaignId} started with ${profileIds.length} profiles`);
  }
}
