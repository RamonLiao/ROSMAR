import { Test } from '@nestjs/testing';
import { AnalystService } from './analyst.service';
import { LlmClientService } from '../llm-client.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnalystService', () => {
  let service: AnalystService;
  let llmClient: { generate: jest.Mock };
  let prisma: Record<string, any>;

  beforeEach(async () => {
    llmClient = { generate: jest.fn() };
    prisma = {
      profile: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', primaryAddress: '0xabc', tags: ['whale'], tier: 3, engagementScore: 85 },
          { id: 'p2', primaryAddress: '0xdef', tags: ['defi'], tier: 1, engagementScore: 42 },
        ]),
        aggregate: jest.fn().mockResolvedValue({ _count: { id: 100 }, _avg: { engagementScore: 55 } }),
        groupBy: jest.fn().mockResolvedValue([
          { tier: 1, _count: { id: 40 } },
          { tier: 2, _count: { id: 35 } },
          { tier: 3, _count: { id: 25 } },
        ]),
      },
      walletEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _count: { id: 50 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      engagementSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      segment: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      segmentMembership: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AnalystService,
        { provide: LlmClientService, useValue: llmClient },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AnalystService);
  });

  it('should call LLM with tool definitions and return formatted results', async () => {
    llmClient.generate.mockResolvedValue({
      toolCalls: [
        {
          toolName: 'query_profiles',
          args: { where: { tier: 3 }, take: 10 },
        },
      ],
      toolResults: [
        {
          toolName: 'query_profiles',
          result: [
            { id: 'p1', primaryAddress: '0xabc', tags: ['whale'], tier: 3, engagementScore: 85 },
            { id: 'p2', primaryAddress: '0xdef', tags: ['defi'], tier: 1, engagementScore: 42 },
          ],
        },
      ],
      text: 'Found 2 high-tier profiles',
      usage: { promptTokens: 500, completionTokens: 200 },
      response: { modelId: 'claude-sonnet-4-20250514' },
    });

    const result = await service.query({
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'Show me all tier 3 profiles',
    });

    expect(llmClient.generate).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        system: expect.stringContaining('Profile'),
        prompt: 'Show me all tier 3 profiles',
        tools: expect.objectContaining({
          query_profiles: expect.any(Object),
          aggregate_data: expect.any(Object),
          group_by_field: expect.any(Object),
        }),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        summary: expect.any(String),
        data: expect.any(Array),
      }),
    );
  });

  it('should pass userId and agentType to LlmClientService for auto-tracking', async () => {
    llmClient.generate.mockResolvedValue({
      toolCalls: [],
      toolResults: [],
      text: 'No matching data found',
      usage: { promptTokens: 300, completionTokens: 100 },
      response: { modelId: 'claude-sonnet-4-20250514' },
    });

    await service.query({
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'How many profiles?',
    });

    expect(llmClient.generate).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        userId: 'user-1',
        agentType: 'analyst',
      }),
    );
  });

  it('should execute query_profiles tool against Prisma', async () => {
    // Simulate the tool execution directly
    llmClient.generate.mockImplementation(async (_wsId: string, params: any) => {
      // Execute the tool function to verify it calls Prisma
      const queryProfilesTool = params.tools.query_profiles;
      const toolResult = await queryProfilesTool.execute(
        { where: { tier: 3 }, take: 5 },
        { toolCallId: 'test-call' },
      );

      return {
        toolCalls: [{ toolName: 'query_profiles', args: { where: { tier: 3 }, take: 5 } }],
        toolResults: [{ toolName: 'query_profiles', result: toolResult }],
        text: 'Found profiles',
        usage: { promptTokens: 100, completionTokens: 50 },
        response: { modelId: 'claude-sonnet-4-20250514' },
      };
    });

    await service.query({
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'tier 3 profiles',
    });

    expect(prisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          tier: 3,
        }),
        take: 5,
      }),
    );
  });

  it('should execute aggregate_data tool against Prisma', async () => {
    llmClient.generate.mockImplementation(async (_wsId: string, params: any) => {
      const aggregateTool = params.tools.aggregate_data;
      const toolResult = await aggregateTool.execute(
        { model: 'profile', _count: true, _avg: { engagementScore: true } },
        { toolCallId: 'test-call' },
      );

      return {
        toolCalls: [],
        toolResults: [{ toolName: 'aggregate_data', result: toolResult }],
        text: 'Aggregated',
        usage: { promptTokens: 100, completionTokens: 50 },
        response: { modelId: 'claude-sonnet-4-20250514' },
      };
    });

    await service.query({
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'average engagement score',
    });

    expect(prisma.profile.aggregate).toHaveBeenCalled();
  });

  it('should reject disallowed models in aggregate_data', async () => {
    llmClient.generate.mockImplementation(async (_wsId: string, params: any) => {
      const aggregateTool = params.tools.aggregate_data;
      const toolResult = await aggregateTool.execute(
        { model: 'workspace', _count: true },
        { toolCallId: 'test-call' },
      );

      return {
        toolCalls: [],
        toolResults: [{ toolName: 'aggregate_data', result: toolResult }],
        text: 'Error',
        usage: { promptTokens: 100, completionTokens: 50 },
        response: { modelId: 'claude-sonnet-4-20250514' },
      };
    });

    const result = await service.query({
      workspaceId: 'ws-1',
      userId: 'user-1',
      query: 'count workspaces',
    });

    // Should not crash but should return error info
    expect(prisma.profile.aggregate).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
