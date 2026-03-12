import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SendTelegramAction } from './actions/send-telegram.action';
import { SendDiscordAction } from './actions/send-discord.action';
import { AirdropTokenAction } from './actions/airdrop-token.action';
import { GrantDiscordRoleAction } from './actions/grant-discord-role.action';
import { IssuePoapAction } from './actions/issue-poap.action';
import { AiGenerateContentAction } from './actions/ai-generate-content.action';
import { AssignQuestAction } from './actions/assign-quest.action';
import { SendEmailAction } from './actions/send-email.action';
import { AddToSegmentAction } from './actions/add-to-segment.action';
import { UpdateTierAction } from './actions/update-tier.action';
import { ConditionAction } from './actions/condition.action';

export interface WorkflowStep {
  type: string;
  config: any;
  delay?: number; // milliseconds to wait before executing
}

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);
  private actions: Map<string, { execute(profileId: string, config: any): Promise<any> }>;

  constructor(
    @InjectQueue('workflow-delay') private readonly delayQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly sendTelegramAction: SendTelegramAction,
    private readonly sendDiscordAction: SendDiscordAction,
    private readonly airdropTokenAction: AirdropTokenAction,
    private readonly grantDiscordRoleAction: GrantDiscordRoleAction,
    private readonly issuePoapAction: IssuePoapAction,
    private readonly aiGenerateContentAction: AiGenerateContentAction,
    private readonly assignQuestAction: AssignQuestAction,
    private readonly sendEmailAction: SendEmailAction,
    private readonly addToSegmentAction: AddToSegmentAction,
    private readonly updateTierAction: UpdateTierAction,
    private readonly conditionAction: ConditionAction,
  ) {
    this.actions = new Map();
    this.actions.set('send_telegram', this.sendTelegramAction);
    this.actions.set('send_discord', this.sendDiscordAction);
    this.actions.set('airdrop_token', this.airdropTokenAction);
    this.actions.set('grant_discord_role', this.grantDiscordRoleAction);
    this.actions.set('issue_poap', this.issuePoapAction);
    this.actions.set('ai_generate_content', this.aiGenerateContentAction);
    this.actions.set('assign_quest', this.assignQuestAction);
    this.actions.set('send_email', this.sendEmailAction);
    this.actions.set('add_to_segment', this.addToSegmentAction);
    this.actions.set('update_tier', this.updateTierAction);
    this.actions.set('condition', this.conditionAction);
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
      const result = await action.execute(profileId, step.config);

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

      // Condition branching: use branch result to determine next step index
      let nextStep = currentStep + 1;
      if (step.type === 'condition' && result?.branch) {
        const branches = step.config?.branches;
        if (branches && typeof branches[result.branch] === 'number') {
          nextStep = branches[result.branch];
        }
      }

      // Advance to next step
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { currentStep: nextStep },
      });

      // Schedule next step (with delay if configured)
      const delay = step.delay || 0;
      if (delay > 0) {
        await this.delayQueue.add(
          'resume',
          { campaignId, profileId, workflowSteps },
          { delay },
        );
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
