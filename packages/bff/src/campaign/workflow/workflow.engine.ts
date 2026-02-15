// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
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
  private pgPool: Pool;
  private actions: Map<string, any>;

  constructor(
    private readonly configService: ConfigService,
    private readonly sendTelegramAction: SendTelegramAction,
    private readonly sendDiscordAction: SendDiscordAction,
    private readonly airdropTokenAction: AirdropTokenAction,
  ) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });

    // Register action handlers
    this.actions = new Map([
      ['send_telegram', this.sendTelegramAction],
      ['send_discord', this.sendDiscordAction],
      ['airdrop_token', this.airdropTokenAction],
    ]);
  }

  async startWorkflow(
    campaignId: string,
    workflowSteps: WorkflowStep[],
    profileIds: string[],
  ): Promise<void> {
    // Create workflow executions for each profile
    for (const profileId of profileIds) {
      await this.pgPool.query(
        `INSERT INTO workflow_executions (
          campaign_id, profile_id, current_step, status, created_at, updated_at
        ) VALUES ($1, $2, 0, 'pending', now(), now())`,
        [campaignId, profileId],
      );
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
    const execution = await this.pgPool.query(
      `SELECT * FROM workflow_executions
       WHERE campaign_id = $1 AND profile_id = $2`,
      [campaignId, profileId],
    );

    if (execution.rows.length === 0) {
      return;
    }

    const execData = execution.rows[0];
    const currentStep = execData.current_step;

    if (currentStep >= workflowSteps.length) {
      // Workflow complete
      await this.pgPool.query(
        `UPDATE workflow_executions
         SET status = 'completed', completed_at = now()
         WHERE campaign_id = $1 AND profile_id = $2`,
        [campaignId, profileId],
      );
      return;
    }

    const step = workflowSteps[currentStep];
    const action = this.actions.get(step.type);

    if (!action) {
      console.error(`Unknown action type: ${step.type}`);
      await this.pgPool.query(
        `UPDATE workflow_executions
         SET status = 'failed', error = $3
         WHERE campaign_id = $1 AND profile_id = $2`,
        [campaignId, profileId, `Unknown action: ${step.type}`],
      );
      return;
    }

    try {
      // Execute action
      await action.execute(profileId, step.config);

      // Log action execution
      await this.pgPool.query(
        `INSERT INTO workflow_action_logs (
          campaign_id, profile_id, step_index, action_type,
          status, executed_at
        ) VALUES ($1, $2, $3, $4, 'success', now())`,
        [campaignId, profileId, currentStep, step.type],
      );

      // Move to next step
      await this.pgPool.query(
        `UPDATE workflow_executions
         SET current_step = $3, updated_at = now()
         WHERE campaign_id = $1 AND profile_id = $2`,
        [campaignId, profileId, currentStep + 1],
      );

      // Schedule next step (with delay if configured)
      const delay = step.delay || 0;
      if (delay > 0) {
        setTimeout(() => {
          this.executeNextStep(campaignId, profileId, workflowSteps);
        }, delay);
      } else {
        await this.executeNextStep(campaignId, profileId, workflowSteps);
      }
    } catch (error) {
      console.error(`Action execution failed:`, error);

      await this.pgPool.query(
        `INSERT INTO workflow_action_logs (
          campaign_id, profile_id, step_index, action_type,
          status, error, executed_at
        ) VALUES ($1, $2, $3, $4, 'failed', $5, now())`,
        [campaignId, profileId, currentStep, step.type, error.message],
      );

      await this.pgPool.query(
        `UPDATE workflow_executions
         SET status = 'failed', error = $3
         WHERE campaign_id = $1 AND profile_id = $2`,
        [campaignId, profileId, error.message],
      );
    }
  }

  async retryFailedExecution(
    campaignId: string,
    profileId: string,
    workflowSteps: WorkflowStep[],
  ): Promise<void> {
    await this.pgPool.query(
      `UPDATE workflow_executions
       SET status = 'pending', error = NULL
       WHERE campaign_id = $1 AND profile_id = $2`,
      [campaignId, profileId],
    );

    await this.executeNextStep(campaignId, profileId, workflowSteps);
  }
}
