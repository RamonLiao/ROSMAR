// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class SegmentEvalJob {
  private queue: Queue;
  private worker: Worker;
  private pgPool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    // TODO: Initialize BullMQ queue
    // const redisUrl = this.configService.get<string>('REDIS_URL');
    // this.queue = new Queue('segment-eval', {
    //   connection: {
    //     url: redisUrl,
    //   },
    // });
    //
    // this.worker = new Worker('segment-eval', async (job) => {
    //   await this.processJob(job.data);
    // }, {
    //   connection: {
    //     url: redisUrl,
    //   },
    // });
  }

  async scheduleEvaluation(segmentId: string): Promise<void> {
    // TODO: Add job to queue
    console.log(`Scheduling segment evaluation for ${segmentId}`);

    // await this.queue.add('evaluate', {
    //   segmentId,
    //   timestamp: Date.now(),
    // });
  }

  private async processJob(data: { segmentId: string }): Promise<void> {
    console.log(`Processing segment evaluation for ${data.segmentId}`);

    // Get segment rules
    const segment = await this.pgPool.query(
      `SELECT rules FROM segments WHERE id = $1`,
      [data.segmentId],
    );

    if (segment.rows.length === 0) {
      throw new Error('Segment not found');
    }

    const rules = segment.rows[0].rules;

    // TODO: Call Rust Core gRPC service to evaluate segment
    // const grpcClient = new CoreServiceClient(...);
    // const profileIds = await grpcClient.evaluateSegment({
    //   segment_id: data.segmentId,
    //   rules: JSON.stringify(rules),
    // });

    // Update segment memberships
    // await this.pgPool.query(
    //   `DELETE FROM segment_memberships WHERE segment_id = $1`,
    //   [data.segmentId],
    // );
    //
    // const values = profileIds.map((_, i) => `($1, $${i + 2}, now())`).join(',');
    // await this.pgPool.query(
    //   `INSERT INTO segment_memberships (segment_id, profile_id, joined_at) VALUES ${values}`,
    //   [data.segmentId, ...profileIds],
    // );
    //
    // await this.pgPool.query(
    //   `UPDATE segments SET last_refreshed_at = now() WHERE id = $1`,
    //   [data.segmentId],
    // );
  }
}
