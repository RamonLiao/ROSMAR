import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LlmClientService } from '../llm-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

// Mock @mysten/sui ESM modules to avoid SyntaxError
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: { fromSecretKey: jest.fn() },
}));
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));

import { ActionService } from './action.service';
import { WorkflowEngine } from '../../campaign/workflow/workflow.engine';

describe('ActionService', () => {
  let service: ActionService;
  let llmClient: { generate: jest.Mock };
  let workflowEngine: { startWorkflow: jest.Mock };
  let cacheService: { set: jest.Mock; get: jest.Mock; evict: jest.Mock };
  let prisma: {
    segment: { findFirst: jest.Mock };
    segmentMembership: { findMany: jest.Mock };
    campaign: { create: jest.Mock };
  };

  beforeEach(async () => {
    llmClient = { generate: jest.fn() };
    workflowEngine = { startWorkflow: jest.fn().mockResolvedValue(undefined) };
    cacheService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      evict: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      segment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'seg-1', name: 'VIPs' }),
      },
      segmentMembership: {
        findMany: jest.fn().mockResolvedValue([{ profileId: 'p-1' }, { profileId: 'p-2' }]),
      },
      campaign: {
        create: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ActionService,
        { provide: LlmClientService, useValue: llmClient },
        { provide: WorkflowEngine, useValue: workflowEngine },
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get(ActionService);
  });

  describe('planAction', () => {
    it('should store plan in Redis with TTL', async () => {
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'Active NFT collectors',
          actions: [{ type: 'send_telegram', config: { message: 'Hello!' } }],
          estimatedCost: 0.5,
        }),
        usage: { inputTokens: 200, outputTokens: 100 },
      });

      const plan = await service.planAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        instruction: 'Send a Telegram message to all NFT collectors',
      });

      expect(plan.planId).toBeDefined();
      expect(plan.targetSegment).toBe('Active NFT collectors');
      expect(plan.actions).toHaveLength(1);
      expect(cacheService.set).toHaveBeenCalledWith(
        `action-plan:${plan.planId}`,
        expect.objectContaining({ workspaceId: 'ws-1' }),
        300,
      );
    });

    it('should filter out invalid action types from LLM output', async () => {
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'All',
          actions: [
            { type: 'send_telegram', config: { message: 'Hi' } },
            { type: 'hack_the_planet', config: {} },
          ],
          estimatedCost: 0,
        }),
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const plan = await service.planAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        instruction: 'test',
      });

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].type).toBe('send_telegram');
    });
  });

  describe('executeAction', () => {
    it('should execute plan from Redis and persist campaign', async () => {
      const storedPlan = {
        planId: 'plan-1',
        workspaceId: 'ws-1',
        targetSegment: 'VIPs',
        actions: [{ type: 'send_telegram', config: { message: 'Hi VIPs!' } }],
        estimatedCost: 1.0,
        createdAt: new Date().toISOString(),
      };
      cacheService.get.mockResolvedValue(storedPlan);

      await service.executeAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        planId: 'plan-1',
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '[AI Action] VIPs' }),
        }),
      );
      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        'camp-1',
        storedPlan.actions,
        ['p-1', 'p-2'],
      );
      expect(cacheService.evict).toHaveBeenCalledWith('action-plan:plan-1');
    });

    it('should throw NotFoundException when plan expired/missing', async () => {
      cacheService.get.mockResolvedValue(null);

      await expect(
        service.executeAction({
          workspaceId: 'ws-1',
          userId: 'user-1',
          planId: 'expired-plan',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
