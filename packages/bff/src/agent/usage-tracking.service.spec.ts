import { Test } from '@nestjs/testing';
import { UsageTrackingService } from './usage-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      llmUsageLog: { create: jest.fn() },
      workspaceAiConfig: { upsert: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(UsageTrackingService);
  });

  it('should log usage and increment quota', async () => {
    prisma.llmUsageLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.workspaceAiConfig.upsert.mockResolvedValue({});

    await service.trackUsage({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'analyst',
      model: 'claude-sonnet-4-20250514',
      promptTokens: 1000,
      completionTokens: 500,
    });

    expect(prisma.llmUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'user-1',
        agentType: 'analyst',
        model: 'claude-sonnet-4-20250514',
        promptTokens: 1000,
        completionTokens: 500,
      }),
    });
    expect(prisma.workspaceAiConfig.upsert).toHaveBeenCalled();
  });

  it('should calculate cost correctly for claude-sonnet-4-20250514', async () => {
    prisma.llmUsageLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.workspaceAiConfig.upsert.mockResolvedValue({});

    await service.trackUsage({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'content',
      model: 'claude-sonnet-4-20250514',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });

    // $3/M input + $15/M output = $18
    const createCall = prisma.llmUsageLog.create.mock.calls[0][0];
    expect(createCall.data.estimatedCostUsd).toBeCloseTo(18.0, 2);
  });

  it('should calculate cost correctly for gpt-4o', async () => {
    prisma.llmUsageLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.workspaceAiConfig.upsert.mockResolvedValue({});

    await service.trackUsage({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'content',
      model: 'gpt-4o',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });

    // $2.5/M input + $10/M output = $12.5
    const createCall = prisma.llmUsageLog.create.mock.calls[0][0];
    expect(createCall.data.estimatedCostUsd).toBeCloseTo(12.5, 2);
  });
});
