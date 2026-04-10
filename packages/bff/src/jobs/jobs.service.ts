import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SegmentEvalJobData } from './segment-eval.job';
import { SegmentDiffJobData } from './segment-diff.job';
import { BroadcastSendJobData } from './broadcast-send.job';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('segment-eval') private readonly segmentEvalQueue: Queue,
    @InjectQueue('segment-refresh') private readonly segmentRefreshQueue: Queue,
    @InjectQueue('segment-diff') private readonly segmentDiffQueue: Queue,
    @InjectQueue('campaign-scheduler')
    private readonly campaignSchedulerQueue: Queue,
    @InjectQueue('sla-checker') private readonly slaCheckerQueue: Queue,
    @InjectQueue('sync-onchain') private readonly syncOnchainQueue: Queue,
    @InjectQueue('vault-expiry') private readonly vaultExpiryQueue: Queue,
    @InjectQueue('score-recalc') private readonly scoreRecalcQueue: Queue,
    @InjectQueue('broadcast-send') private readonly broadcastSendQueue: Queue,
    @InjectQueue('time-elapsed-trigger')
    private readonly timeElapsedQueue: Queue,
    @InjectQueue('balance-sync') private readonly balanceSyncQueue: Queue,
    @InjectQueue('discord-role-sync')
    private readonly discordRoleSyncQueue: Queue,
    @InjectQueue('campaign-recurring')
    private readonly campaignRecurringQueue: Queue,
    @InjectQueue('vault-release') private readonly vaultReleaseQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log(
      'JobsService initializing — registering cron schedulers...',
    );
    await this.registerCronJobs();
    this.logger.log('BullMQ cron jobs registered');
  }

  private async registerCronJobs(): Promise<void> {
    await this.segmentRefreshQueue.upsertJobScheduler(
      'segment-refresh-cron',
      { pattern: '*/15 * * * *' },
      { name: 'refresh', data: {} },
    );

    await this.segmentEvalQueue.upsertJobScheduler(
      'segment-eval-cron',
      { pattern: '*/15 * * * *' },
      { name: 'eval-all', data: {} },
    );

    await this.segmentDiffQueue.upsertJobScheduler(
      'segment-diff-cron',
      { pattern: '*/30 * * * *' },
      { name: 'diff-all', data: {} },
    );

    await this.campaignSchedulerQueue.upsertJobScheduler(
      'campaign-scheduler-cron',
      { pattern: '* * * * *' },
      { name: 'check-scheduled', data: {} },
    );

    await this.slaCheckerQueue.upsertJobScheduler(
      'sla-checker-cron',
      { pattern: '*/5 * * * *' },
      { name: 'check-sla', data: {} },
    );

    await this.syncOnchainQueue.upsertJobScheduler(
      'sync-onchain-cron',
      { pattern: '*/10 * * * *' },
      { name: 'sync', data: {} },
    );

    await this.vaultExpiryQueue.upsertJobScheduler(
      'vault-expiry-cron',
      { pattern: '0 * * * *' },
      { name: 'archive-expired', data: {} },
    );

    await this.scoreRecalcQueue.upsertJobScheduler(
      'score-recalc-cron',
      { pattern: '0 * * * *' },
      { name: 'recalc-all', data: {} },
    );
    // broadcast-send: on-demand only, no cron

    await this.timeElapsedQueue.upsertJobScheduler(
      'time-elapsed-trigger-cron',
      { pattern: '*/15 * * * *' },
      { name: 'check-elapsed', data: {} },
    );

    await this.balanceSyncQueue.upsertJobScheduler(
      'balance-sync-cron',
      { pattern: '0 */6 * * *' },
      { name: 'sync-all', data: {} },
    );

    await this.discordRoleSyncQueue.upsertJobScheduler(
      'discord-role-sync-cron',
      { pattern: '0 3 * * *' },
      { name: 'sync-all', data: {} },
    );

    await this.vaultReleaseQueue.upsertJobScheduler(
      'vault-release-cron',
      { pattern: '* * * * *' },
      { name: 'check-release', data: {} },
    );
  }

  async scheduleSegmentEval(segmentId: string): Promise<void> {
    await this.segmentEvalQueue.add('evaluate', {
      segmentId,
    } satisfies SegmentEvalJobData);
  }

  async scheduleSegmentDiff(segmentId: string): Promise<void> {
    await this.segmentDiffQueue.add('diff', {
      segmentId,
    } satisfies SegmentDiffJobData);
  }

  async scheduleBroadcastSend(data: BroadcastSendJobData): Promise<void> {
    await this.broadcastSendQueue.add('send', data);
  }

  async getHealth(): Promise<
    Record<string, { waiting: number; active: number; failed: number }>
  > {
    const queues: Array<[string, Queue]> = [
      ['segment-eval', this.segmentEvalQueue],
      ['segment-refresh', this.segmentRefreshQueue],
      ['segment-diff', this.segmentDiffQueue],
      ['campaign-scheduler', this.campaignSchedulerQueue],
      ['sla-checker', this.slaCheckerQueue],
      ['sync-onchain', this.syncOnchainQueue],
      ['vault-expiry', this.vaultExpiryQueue],
      ['score-recalc', this.scoreRecalcQueue],
      ['broadcast-send', this.broadcastSendQueue],
      ['time-elapsed-trigger', this.timeElapsedQueue],
      ['balance-sync', this.balanceSyncQueue],
      ['discord-role-sync', this.discordRoleSyncQueue],
      ['campaign-recurring', this.campaignRecurringQueue],
      ['vault-release', this.vaultReleaseQueue],
    ];

    const result: Record<
      string,
      { waiting: number; active: number; failed: number }
    > = {};

    for (const [name, queue] of queues) {
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      result[name] = { waiting, active, failed };
    }

    return result;
  }
}
