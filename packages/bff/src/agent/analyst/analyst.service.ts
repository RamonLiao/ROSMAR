import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { tool, type ToolSet } from 'ai';
import { LlmClientService } from '../llm-client.service';
import { UsageTrackingService } from '../usage-tracking.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Only these Prisma models can be queried by the analyst agent */
const ALLOWED_MODELS = [
  'profile',
  'segment',
  'segmentMembership',
  'walletEvent',
  'engagementSnapshot',
] as const;

type AllowedModel = (typeof ALLOWED_MODELS)[number];

function isAllowedModel(m: string): m is AllowedModel {
  return (ALLOWED_MODELS as readonly string[]).includes(m);
}

export interface AnalystQueryParams {
  workspaceId: string;
  userId: string;
  query: string;
}

export interface AnalystQueryResult {
  summary: string;
  data: any[];
  chartConfig?: { type: string; xKey: string; yKey: string };
}

const SYSTEM_PROMPT = `You are an AI analyst for a Web3 CRM. You help users query their CRM data using natural language.

Available data models and their key fields:
- Profile: id, primaryAddress, tags (string[]), tier (0-5), engagementScore (0-100), suinsName, email, isArchived, createdAt, updatedAt
- Segment: id, name, description, rules (JSON), lastRefreshedAt, createdAt
- SegmentMembership: segmentId, profileId, enteredAt
- WalletEvent: id, address, eventType, collection, token, amount, txDigest, time
- EngagementSnapshot: id, profileId, score, breakdown (JSON), calculatedAt

You have tools to query, aggregate, and group data. Use them to answer the user's question.
Always scope queries to the user's workspace (workspaceId is automatically added).
After getting results, provide a concise summary. If the data suits a chart, suggest a chartConfig with type (bar/line/pie), xKey, and yKey.`;

@Injectable()
export class AnalystService {
  private readonly logger = new Logger(AnalystService.name);

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly usageTracking: UsageTrackingService,
    private readonly prisma: PrismaService,
  ) {}

  async query(params: AnalystQueryParams): Promise<AnalystQueryResult> {
    const { workspaceId, userId, query } = params;

    const tools = this.buildTools(workspaceId);

    const result = await this.llmClient.generate(workspaceId, {
      system: SYSTEM_PROMPT,
      prompt: query,
      tools,
    });

    // Track usage — ai SDK v6 uses inputTokens/outputTokens
    const model = result.response?.modelId ?? 'unknown';
    const usage: any = result.usage ?? {};
    await this.usageTracking.trackUsage({
      workspaceId,
      userId,
      agentType: 'analyst',
      model,
      promptTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
      completionTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
    });

    // Extract data from tool results
    const data =
      result.toolResults
        ?.map((tr: any) => tr.result)
        .flat()
        .filter(Boolean) ?? [];

    // Parse chart config from LLM text if present
    const chartConfig = this.parseChartConfig(result.text);

    return {
      summary: result.text || 'Query completed.',
      data: Array.isArray(data) ? data : [data],
      chartConfig,
    };
  }

  private buildTools(workspaceId: string): ToolSet {
    const modelEnum = z.enum([
      'profile',
      'segment',
      'segmentMembership',
      'walletEvent',
      'engagementSnapshot',
    ]);

    return {
      query_profiles: tool({
        description:
          'Query profiles with optional filters, sorting, and limit. Returns matching profile records.',
        inputSchema: z.object({
          where: z
            .record(z.string(), z.unknown())
            .optional()
            .describe(
              'Prisma where filter (e.g. { tier: 3, tags: { has: "whale" } })',
            ),
          orderBy: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Prisma orderBy (e.g. { engagementScore: "desc" })'),
          take: z
            .number()
            .optional()
            .default(20)
            .describe('Max results to return'),
        }),
        execute: async (args) => {
          return this.prisma.profile.findMany({
            where: { workspaceId, ...(args.where as any) },
            orderBy: args.orderBy as any,
            take: Math.min(args.take ?? 20, 100),
            select: {
              id: true,
              primaryAddress: true,
              suinsName: true,
              tags: true,
              tier: true,
              engagementScore: true,
              email: true,
              createdAt: true,
            },
          });
        },
      }),

      aggregate_data: tool({
        description:
          'Run aggregate queries (_count, _avg, _sum, _min, _max) on a model.',
        inputSchema: z.object({
          model: modelEnum.describe('Model to aggregate'),
          _count: z.unknown().optional().describe('Count config (true or field map)'),
          _avg: z.record(z.string(), z.boolean()).optional().describe('Average fields'),
          _sum: z.record(z.string(), z.boolean()).optional().describe('Sum fields'),
          _min: z.record(z.string(), z.boolean()).optional().describe('Min fields'),
          _max: z.record(z.string(), z.boolean()).optional().describe('Max fields'),
          where: z.record(z.string(), z.unknown()).optional().describe('Prisma where filter'),
        }),
        execute: async (args) => {
          if (!isAllowedModel(args.model)) {
            return { error: `Model "${args.model}" is not allowed` };
          }

          const prismaModel = (this.prisma as any)[args.model];
          if (!prismaModel?.aggregate) {
            return { error: `Model "${args.model}" does not support aggregate` };
          }

          const aggregateArgs: any = {
            where: { workspaceId, ...args.where },
          };
          if (args._count) aggregateArgs._count = args._count;
          if (args._avg) aggregateArgs._avg = args._avg;
          if (args._sum) aggregateArgs._sum = args._sum;
          if (args._min) aggregateArgs._min = args._min;
          if (args._max) aggregateArgs._max = args._max;

          return prismaModel.aggregate(aggregateArgs);
        },
      }),

      group_by_field: tool({
        description: 'Group records by fields with optional count/aggregation.',
        inputSchema: z.object({
          model: modelEnum.describe('Model to group'),
          by: z.array(z.string()).describe('Fields to group by'),
          _count: z.unknown().optional().describe('Count config'),
          _avg: z.record(z.string(), z.boolean()).optional(),
          _sum: z.record(z.string(), z.boolean()).optional(),
          where: z.record(z.string(), z.unknown()).optional().describe('Prisma where filter'),
          orderBy: z.record(z.string(), z.unknown()).optional(),
        }),
        execute: async (args) => {
          if (!isAllowedModel(args.model)) {
            return { error: `Model "${args.model}" is not allowed` };
          }

          const prismaModel = (this.prisma as any)[args.model];
          if (!prismaModel?.groupBy) {
            return { error: `Model "${args.model}" does not support groupBy` };
          }

          const groupArgs: any = {
            by: args.by,
            where: { workspaceId, ...args.where },
          };
          if (args._count) groupArgs._count = args._count;
          if (args._avg) groupArgs._avg = args._avg;
          if (args._sum) groupArgs._sum = args._sum;
          if (args.orderBy) groupArgs.orderBy = args.orderBy;

          return prismaModel.groupBy(groupArgs);
        },
      }),
    };
  }

  private parseChartConfig(
    text: string,
  ): { type: string; xKey: string; yKey: string } | undefined {
    const match = text?.match(/chartConfig["\s:]*(\{[^}]+\})/i);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // ignore parse errors
      }
    }
    return undefined;
  }
}
