import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmClientService } from '../llm-client.service';
import {
  WorkflowEngine,
  type WorkflowStep,
} from '../../campaign/workflow/workflow.engine';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

export interface ActionPlan {
  planId: string;
  targetSegment: string;
  actions: WorkflowStep[];
  estimatedCost: number;
  createdAt: string;
}

export interface PlanActionParams {
  workspaceId: string;
  userId: string;
  instruction: string;
}

export interface ExecuteActionParams {
  workspaceId: string;
  userId: string;
  planId: string;
}

const PLAN_TTL_SECONDS = 300;

const VALID_ACTION_TYPES = new Set([
  'send_telegram',
  'send_discord',
  'send_email',
  'airdrop_token',
  'grant_discord_role',
  'issue_poap',
  'ai_generate_content',
  'assign_quest',
  'add_to_segment',
  'update_tier',
  'condition',
]);

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async planAction(params: PlanActionParams): Promise<ActionPlan> {
    const { workspaceId, userId, instruction } = params;
    const system = [
      'You are an AI campaign planner for a Web3 CRM.',
      'Convert the user instruction into a structured JSON action plan.',
      `Available action types: ${[...VALID_ACTION_TYPES].join(', ')}.`,
      'Output ONLY valid JSON with this schema:',
      '{ "targetSegment": string, "actions": [{ "type": string, "config": object, "delay"?: number }], "estimatedCost": number }',
    ].join('\n');

    const result = await this.llmClient.generate(workspaceId, {
      system,
      prompt: instruction,
      userId,
      agentType: 'action',
    });

    const parsed = this.parseJson(result.text);
    const planId = randomUUID();

    const validatedActions = (parsed.actions ?? []).filter(
      (a: any) => VALID_ACTION_TYPES.has(a.type),
    );

    const plan: ActionPlan = {
      planId,
      targetSegment: parsed.targetSegment ?? 'Unknown',
      actions: validatedActions,
      estimatedCost: parsed.estimatedCost ?? 0,
      createdAt: new Date().toISOString(),
    };

    await this.cacheService.set(
      `action-plan:${planId}`,
      { ...plan, workspaceId },
      PLAN_TTL_SECONDS,
    );

    return plan;
  }

  async executeAction(params: ExecuteActionParams): Promise<void> {
    const { planId } = params;

    const stored = await this.cacheService.get<ActionPlan & { workspaceId: string }>(
      `action-plan:${planId}`,
    );
    if (!stored) {
      throw new NotFoundException(
        `Plan ${planId} not found or expired. Please create a new plan.`,
      );
    }

    const segment = await this.prisma.segment.findFirst({
      where: {
        workspaceId: stored.workspaceId,
        name: { contains: stored.targetSegment, mode: 'insensitive' as any },
      },
    });

    const segmentId = segment?.id;
    let profileIds: string[] = [];

    if (segmentId) {
      const memberships = await this.prisma.segmentMembership.findMany({
        where: { segmentId },
        select: { profileId: true },
      });
      profileIds = memberships.map((m) => m.profileId);
    }

    if (!segmentId) {
      this.logger.warn('No segment found for action plan, skipping campaign creation');
      return;
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        id: randomUUID(),
        workspaceId: stored.workspaceId,
        name: `[AI Action] ${stored.targetSegment}`,
        segmentId,
        status: 'active',
        workflowSteps: stored.actions as any,
      },
    });

    await this.workflowEngine.startWorkflow(
      campaign.id,
      stored.actions,
      profileIds,
    );

    await this.cacheService.evict(`action-plan:${planId}`);
  }

  private parseJson(text: string): any {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(raw);
    } catch {
      return { targetSegment: 'Unknown', actions: [], estimatedCost: 0 };
    }
  }
}
