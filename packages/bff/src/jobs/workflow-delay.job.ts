import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WorkflowEngine } from '../campaign/workflow/workflow.engine';

export interface WorkflowDelayJobData {
  campaignId: string;
  profileId: string;
  workflowSteps: any[];
}

@Processor('workflow-delay')
export class WorkflowDelayJob extends WorkerHost {
  private readonly logger = new Logger(WorkflowDelayJob.name);

  constructor(private readonly workflowEngine: WorkflowEngine) {
    super();
  }

  async process(job: Job<WorkflowDelayJobData>): Promise<void> {
    const { campaignId, profileId, workflowSteps } = job.data;
    this.logger.log(
      `Resuming workflow for campaign=${campaignId} profile=${profileId}`,
    );
    await this.workflowEngine.executeNextStep(
      campaignId,
      profileId,
      workflowSteps,
    );
  }
}
