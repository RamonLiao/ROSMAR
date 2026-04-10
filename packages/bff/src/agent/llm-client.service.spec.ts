/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test } from '@nestjs/testing';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// --- mock ai SDK ---
const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: (...args: any[]) => mockGenerateText(...args),
  streamText: jest.fn(),
  stepCountIs: jest.fn(),
}));

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => () => ({ modelId: 'claude-sonnet-4-20250514' }),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => () => ({ modelId: 'gpt-4o' }),
}));

describe('LlmClientService', () => {
  let service: LlmClientService;
  let prisma: { workspaceAiConfig: { findUnique: jest.Mock } };
  let usageTracking: { trackUsage: jest.Mock };

  beforeEach(async () => {
    prisma = { workspaceAiConfig: { findUnique: jest.fn() } };
    usageTracking = { trackUsage: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        LlmClientService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                ANTHROPIC_API_KEY: 'platform-key-123',
                OPENAI_API_KEY: 'platform-oai-key',
              };
              return map[key] ?? '';
            },
          },
        },
        { provide: UsageTrackingService, useValue: usageTracking },
        {
          provide: EncryptionService,
          useValue: { encrypt: jest.fn(), decrypt: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(LlmClientService);
  });

  it('should use platform key when workspace has no BYOK config', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue(null);
    const result = await service.resolveConfig('workspace-1');
    expect(result.provider).toBe('anthropic');
    expect(result.apiKey).toBe('platform-key-123');
  });

  it('should reject when quota exceeded', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue({
      provider: 'anthropic',
      apiKeyEncrypted: null,
      isEnabled: true,
      monthlyQuotaUsd: 10,
      usedQuotaUsd: 10.5,
    });
    await expect(service.resolveConfig('workspace-1')).rejects.toThrow(
      'AI quota exceeded',
    );
  });

  it('generate() should auto-track usage', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue(null);
    mockGenerateText.mockResolvedValue({
      text: 'hello',
      usage: { promptTokens: 100, completionTokens: 50 },
      response: { modelId: 'claude-sonnet-4-20250514' },
    });

    await service.generate('ws-1', {
      prompt: 'hi',
      userId: 'user-1',
      agentType: 'deal',
    });

    // fire-and-forget — flush microtasks
    await new Promise((r) => setImmediate(r));

    expect(usageTracking.trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'user-1',
        agentType: 'deal',
        promptTokens: 100,
        completionTokens: 50,
      }),
    );
  });

  it('generate() should not fail if tracking fails', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue(null);
    mockGenerateText.mockResolvedValue({
      text: 'hello',
      usage: { promptTokens: 10, completionTokens: 5 },
      response: { modelId: 'claude-sonnet-4-20250514' },
    });
    usageTracking.trackUsage.mockRejectedValue(new Error('db down'));

    const result = await service.generate('ws-1', {
      prompt: 'hi',
      userId: 'user-1',
      agentType: 'deal',
    });

    // flush fire-and-forget
    await new Promise((r) => setImmediate(r));

    expect(result.text).toBe('hello');
  });
});
