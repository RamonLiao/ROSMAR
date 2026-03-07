import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LlmClientService } from '../llm-client.service';
import { UsageTrackingService } from '../usage-tracking.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @mysten/sui ESM modules to avoid SyntaxError
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({ Ed25519Keypair: { fromSecretKey: jest.fn() } }));
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));

import { ActionService } from './action.service';
import { WorkflowEngine } from '../../campaign/workflow/workflow.engine';

describe('ActionService', () => {
  let service: ActionService;
  let llmClient: { generate: jest.Mock; resolveConfig: jest.Mock };
  let usageTracking: { trackUsage: jest.Mock };
  let workflowEngine: { startWorkflow: jest.Mock };
  let prisma: {
    segment: { findFirst: jest.Mock };
    segmentMembership: { findMany: jest.Mock };
    campaign: { create: jest.Mock };
  };

  beforeEach(async () => {
    llmClient = {
      generate: jest.fn(),
      resolveConfig: jest.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-4o-mini' }),
    };
    usageTracking = { trackUsage: jest.fn().mockResolvedValue(undefined) };
    workflowEngine = { startWorkflow: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      segment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'seg-1', name: 'VIPs' }),
      },
      segmentMembership: {
        findMany: jest.fn().mockResolvedValue([
          { profileId: 'p-1' },
          { profileId: 'p-2' },
        ]),
      },
      campaign: {
        create: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ActionService,
        { provide: LlmClientService, useValue: llmClient },
        { provide: UsageTrackingService, useValue: usageTracking },
        { provide: WorkflowEngine, useValue: workflowEngine },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ActionService);
  });

  describe('planAction', () => {
    it('should convert NL instruction to structured plan via LLM', async () => {
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'Active NFT collectors',
          actions: [
            { type: 'send_telegram', config: { message: 'Hello!' } },
          ],
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
      expect(plan.actions[0].type).toBe('send_telegram');
      expect(plan.estimatedCost).toBe(0.5);
      expect(plan.createdAt).toBeInstanceOf(Date);
    });

    it('should track usage for plan generation', async () => {
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'All users',
          actions: [],
          estimatedCost: 0,
        }),
        usage: { inputTokens: 150, outputTokens: 80 },
      });

      await service.planAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        instruction: 'Do something',
      });

      expect(usageTracking.trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'action',
          promptTokens: 150,
          completionTokens: 80,
        }),
      );
    });
  });

  describe('executeAction', () => {
    it('should execute a valid plan via WorkflowEngine', async () => {
      // First create a plan
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'VIPs',
          actions: [
            { type: 'send_telegram', config: { message: 'Hi VIPs!' } },
          ],
          estimatedCost: 1.0,
        }),
        usage: { inputTokens: 200, outputTokens: 100 },
      });

      const plan = await service.planAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        instruction: 'Message VIPs on Telegram',
      });

      // Then execute it
      await service.executeAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        planId: plan.planId,
      });

      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        expect.any(String), // campaignId
        plan.actions,
        ['p-1', 'p-2'],
      );
    });

    it('should reject missing plan', async () => {
      await expect(
        service.executeAction({
          workspaceId: 'ws-1',
          userId: 'user-1',
          planId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject stale plan (>5 min old)', async () => {
      llmClient.generate.mockResolvedValue({
        text: JSON.stringify({
          targetSegment: 'All',
          actions: [{ type: 'send_discord', config: { message: 'Hey' } }],
          estimatedCost: 0,
        }),
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const plan = await service.planAction({
        workspaceId: 'ws-1',
        userId: 'user-1',
        instruction: 'Send discord msg',
      });

      // Manually set createdAt to 6 minutes ago
      (service as any).plans.get(plan.planId).createdAt = new Date(
        Date.now() - 6 * 60 * 1000,
      );

      await expect(
        service.executeAction({
          workspaceId: 'ws-1',
          userId: 'user-1',
          planId: plan.planId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
