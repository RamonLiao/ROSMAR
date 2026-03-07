import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TrackUsageParams {
  workspaceId: string;
  userId: string;
  agentType: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/** Per-million-token pricing (input, output) in USD */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

@Injectable()
export class UsageTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async trackUsage(params: TrackUsageParams): Promise<void> {
    const pricing = MODEL_PRICING[params.model] ?? DEFAULT_PRICING;
    const estimatedCostUsd =
      (params.promptTokens / 1_000_000) * pricing.input +
      (params.completionTokens / 1_000_000) * pricing.output;

    await this.prisma.llmUsageLog.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        agentType: params.agentType,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        estimatedCostUsd,
      },
    });

    // Increment used quota (upsert to handle first-time usage)
    await this.prisma.workspaceAiConfig.upsert({
      where: { workspaceId: params.workspaceId },
      update: {
        usedQuotaUsd: { increment: estimatedCostUsd },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: 'anthropic',
        usedQuotaUsd: estimatedCostUsd,
        quotaResetAt: this.getNextMonthStart(),
      },
    });
  }

  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
