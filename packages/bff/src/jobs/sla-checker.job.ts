// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class SlaCheckerJob {
  private queue: Queue;
  private worker: Worker;
  private pgPool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    // TODO: Initialize BullMQ queue with repeat pattern
    // const redisUrl = this.configService.get<string>('REDIS_URL');
    // this.queue = new Queue('sla-checker', {
    //   connection: { url: redisUrl },
    // });
    //
    // // Schedule recurring check every 5 minutes
    // this.queue.add('check-sla', {}, {
    //   repeat: { pattern: '*/5 * * * *' },
    // });
    //
    // this.worker = new Worker('sla-checker', async (job) => {
    //   await this.checkSlaViolations();
    // }, {
    //   connection: { url: redisUrl },
    // });
  }

  private async checkSlaViolations(): Promise<void> {
    console.log('Checking for SLA violations...');

    // Check deals stuck in stage for too long
    const staleDeal = await this.pgPool.query(
      `SELECT id, workspace_id, profile_id, stage, updated_at
       FROM deals
       WHERE status = 'active'
         AND updated_at < now() - interval '7 days'
       LIMIT 50`,
    );

    for (const deal of staleDeal.rows) {
      await this.createSlaAlert(
        deal.workspace_id,
        'deal_stale',
        `Deal ${deal.id} stuck in ${deal.stage} for > 7 days`,
        { dealId: deal.id, profileId: deal.profile_id },
      );
    }

    // Check campaigns with low engagement
    const lowEngagementCampaigns = await this.pgPool.query(
      `SELECT c.id, c.workspace_id, c.name,
              COUNT(we.id) as total,
              COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed
       FROM campaigns c
       LEFT JOIN workflow_executions we ON we.campaign_id = c.id
       WHERE c.status = 'active'
         AND c.started_at < now() - interval '1 day'
       GROUP BY c.id
       HAVING (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::float / NULLIF(COUNT(we.id), 0)) < 0.3`,
    );

    for (const campaign of lowEngagementCampaigns.rows) {
      await this.createSlaAlert(
        campaign.workspace_id,
        'campaign_low_engagement',
        `Campaign ${campaign.name} has < 30% completion rate`,
        { campaignId: campaign.id },
      );
    }
  }

  private async createSlaAlert(
    workspaceId: string,
    alertType: string,
    message: string,
    metadata: any,
  ): Promise<void> {
    await this.pgPool.query(
      `INSERT INTO sla_alerts (
        workspace_id, alert_type, message, metadata, created_at
      ) VALUES ($1, $2, $3, $4, now())`,
      [workspaceId, alertType, message, JSON.stringify(metadata)],
    );

    console.log(`SLA Alert created: ${alertType} - ${message}`);
  }
}
