import { Injectable, OnModuleInit } from '@nestjs/common';
import { SegmentEvalJob } from './segment-eval.job';
import { CampaignSchedulerJob } from './campaign-scheduler.job';
import { SlaCheckerJob } from './sla-checker.job';
import { SyncOnchainJob } from './sync-onchain.job';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    private readonly segmentEvalJob: SegmentEvalJob,
    private readonly campaignSchedulerJob: CampaignSchedulerJob,
    private readonly slaCheckerJob: SlaCheckerJob,
    private readonly syncOnchainJob: SyncOnchainJob,
  ) {}

  onModuleInit() {
    console.log('JobsService initialized (BullMQ workers ready)');
    // Workers auto-start when BullMQ queues are configured
  }

  async stopAll() {
    console.log('Stopping all job workers...');
    // TODO: Close BullMQ workers
    // await this.segmentEvalJob.worker?.close();
    // await this.campaignSchedulerJob.worker?.close();
    // await this.slaCheckerJob.worker?.close();
    // await this.syncOnchainJob.worker?.close();
  }
}
