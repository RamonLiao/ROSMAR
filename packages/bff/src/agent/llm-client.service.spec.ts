import { Test } from '@nestjs/testing';
import { LlmClientService } from './llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('LlmClientService', () => {
  let service: LlmClientService;
  let prisma: { workspaceAiConfig: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { workspaceAiConfig: { findUnique: jest.fn() } };
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

  it('should use BYOK key when workspace has config', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue({
      provider: 'openai',
      apiKeyEncrypted: 'byok-key-456',
      isEnabled: true,
      monthlyQuotaUsd: 100,
      usedQuotaUsd: 5,
    });
    const result = await service.resolveConfig('workspace-1');
    expect(result.provider).toBe('openai');
    expect(result.apiKey).toBe('byok-key-456');
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
});
