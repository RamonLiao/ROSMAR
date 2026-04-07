import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmClientService } from '../llm-client.service';
import { WorkflowEngine, type WorkflowStep } from '../../campaign/workflow/workflow.engine';
import { PrismaService } from '../../prisma/prisma.service';

export interface ActionPlan {
  planId: string;
  targetSegment: string;
  actions: WorkflowStep[];
  estimatedCost: number;
  createdAt: Date;
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

const PLAN_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ActionService {
  private readonly plans = new Map<string, ActionPlan & { workspaceId: string }>();

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly prisma: PrismaService,
  ) {}

  async planAction(params: PlanActionParams): Promise<ActionPlan> {
    const { workspaceId, userId, instruction } = params;
    const system = [
      'You are an AI campaign planner for a Web3 CRM.',
      'Convert the user instruction into a structured JSON action plan.',
      'Available action types: send_telegram, send_discord, airdrop_token.',
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
    const plan: ActionPlan = {
      planId,
      targetSegment: parsed.targetSegment ?? 'Unknown',
      actions: parsed.actions ?? [],
      estimatedCost: parsed.estimatedCost ?? 0,
      createdAt: new Date(),
    };

    this.plans.set(planId, { ...plan, workspaceId });

    return plan;
  }

  async executeAction(params: ExecuteActionParams): Promise<void> {
    const { planId } = params;

    const stored = this.plans.get(planId);
    if (!stored) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    const age = Date.now() - stored.createdAt.getTime();
    if (age > PLAN_TTL_MS) {
      this.plans.delete(planId);
      throw new BadRequestException(
        `Plan ${planId} has expired (>5 min). Please create a new plan.`,
      );
    }

    // Find segment by name match
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

    // Create an ad-hoc campaign
    const campaignId = randomUUID();

    await this.workflowEngine.startWorkflow(
      campaignId,
      stored.actions,
      profileIds,
    );

    // Clean up used plan
    this.plans.delete(planId);
  }

  private parseJson(text: string): any {
    // Try to extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(raw);
    } catch {
      return { targetSegment: 'Unknown', actions: [], estimatedCost: 0 };
    }
  }
}
