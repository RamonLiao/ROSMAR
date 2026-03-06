import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendTelegramAction } from './actions/send-telegram.action';
import { SendDiscordAction } from './actions/send-discord.action';
import { AirdropTokenAction } from './actions/airdrop-token.action';

export interface WorkflowStep {
  type: string;
  config: any;
  delay?: number; // milliseconds to wait before executing
}

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);
  private actions: Map<string, { execute(profileId: string, config: any): Promise<void> }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendTelegramAction: SendTelegramAction,
    private readonly sendDiscordAction: SendDiscordAction,
    private readonly airdropTokenAction: AirdropTokenAction,
  ) {
    this.actions = new Map();
    this.actions.set('send_telegram', this.sendTelegramAction);
    this.actions.set('send_discord', this.sendDiscordAction);
    this.actions.set('airdrop_token', this.airdropTokenAction);
  }

  async startWorkflow(
    campaignId: string,
    workflowSteps: WorkflowStep[],
    profileIds: string[],
  ): Promise<void> {
    // Create workflow executions for each profile (upsert to handle retries)
    for (const profileId of profileIds) {
      await this.prisma.workflowExecution.upsert({
        where: { campaignId_profileId: { campaignId, profileId } },
        create: { campaignId, profileId, currentStep: 0, status: 'pending' },
        update: { currentStep: 0, status: 'pending', error: null, completedAt: null },
      });
    }

    // Trigger first step for all profiles
    for (const profileId of profileIds) {
      await this.executeNextStep(campaignId, profileId, workflowSteps);
    }
  }

  async executeNextStep(
    campaignId: string,
    profileId: string,
    workflowSteps: WorkflowStep[],
  ): Promise<void> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { campaignId_profileId: { campaignId, profileId } },
    });

    if (!execution) return;

    const currentStep = execution.currentStep;

    if (currentStep >= workflowSteps.length) {
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      return;
    }

    const step = workflowSteps[currentStep];
    const action = this.actions.get(step.type);

    if (!action) {
      const errorMsg = `Unknown action: ${step.type}`;
      this.logger.error(errorMsg);
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', error: errorMsg },
      });
      return;
    }

    try {
      await action.execute(profileId, step.config);

      // Log successful action
      await this.prisma.workflowActionLog.create({
        data: {
          campaignId,
          profileId,
          stepIndex: currentStep,
          actionType: step.type,
          status: 'success',
        },
      });

      // Advance to next step
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { currentStep: currentStep + 1 },
      });

      // Schedule next step (with delay if configured)
      const delay = step.delay || 0;
      if (delay > 0) {
        setTimeout(() => {
          this.executeNextStep(campaignId, profileId, workflowSteps);
        }, delay);
      } else {
        await this.executeNextStep(campaignId, profileId, workflowSteps);
      }
    } catch (error: any) {
      this.logger.error(`Action execution failed: ${error.message}`, error.stack);

      await this.prisma.workflowActionLog.create({
        data: {
          campaignId,
          profileId,
          stepIndex: currentStep,
          actionType: step.type,
          status: 'failed',
          error: error.message,
        },
      });

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', error: error.message },
      });
    }
  }

  async retryFailedExecution(
    campaignId: string,
    profileId: string,
    workflowSteps: WorkflowStep[],
  ): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { campaignId_profileId: { campaignId, profileId } },
      data: { status: 'pending', error: null },
    });

    await this.executeNextStep(campaignId, profileId, workflowSteps);
  }
}
