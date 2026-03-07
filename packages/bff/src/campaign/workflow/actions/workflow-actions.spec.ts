// Mock @mysten/sui ESM modules before any imports
jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    moveCall: jest.fn(),
    pure: { address: jest.fn(), string: jest.fn() },
  })),
}));

jest.mock('../../../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    executeTransaction: jest.fn().mockResolvedValue({ digest: 'tx-123' }),
  })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GrantDiscordRoleAction } from './grant-discord-role.action';
import { IssuePoapAction } from './issue-poap.action';
import { AiGenerateContentAction } from './ai-generate-content.action';
import { PrismaService } from '../../../prisma/prisma.service';
import { SuiClientService } from '../../../blockchain/sui.client';
import { LlmClientService } from '../../../agent/llm-client.service';

// ─── Mocks ───────────────────────────────────────────────────────

const mockPrisma = {
  socialLink: { findUnique: jest.fn() },
  profile: { findUniqueOrThrow: jest.fn() },
  workflowActionLog: { findFirst: jest.fn(), update: jest.fn() },
};

const mockSuiClient = {
  executeTransaction: jest.fn().mockResolvedValue({ digest: 'tx-123' }),
};

const mockLlmClient = {
  generate: jest.fn(),
  resolveConfig: jest.fn().mockResolvedValue({ provider: 'openai' }),
};

// ─── GrantDiscordRoleAction ──────────────────────────────────────

describe('GrantDiscordRoleAction', () => {
  let action: GrantDiscordRoleAction;
  const originalFetch = global.fetch;
  const originalEnv = process.env.DISCORD_BOT_TOKEN;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token';

    const module = await Test.createTestingModule({
      providers: [
        GrantDiscordRoleAction,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    action = module.get(GrantDiscordRoleAction);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.DISCORD_BOT_TOKEN = originalEnv;
  });

  it('should call Discord API to grant role', async () => {
    mockPrisma.socialLink.findUnique.mockResolvedValue({
      platformUserId: 'discord-user-123',
      oauthTokenEncrypted: 'encrypted-token',
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    await action.execute('profile-1', { guildId: 'guild-1', roleId: 'role-1' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/guilds/guild-1/members/discord-user-123/roles/role-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bot test-bot-token',
        }),
      }),
    );
  });

  it('should throw if no Discord link found', async () => {
    mockPrisma.socialLink.findUnique.mockResolvedValue(null);

    await expect(
      action.execute('profile-1', { guildId: 'g', roleId: 'r' }),
    ).rejects.toThrow('No Discord OAuth token');
  });

  it('should throw if Discord API returns error', async () => {
    mockPrisma.socialLink.findUnique.mockResolvedValue({
      platformUserId: 'discord-user-123',
      oauthTokenEncrypted: 'enc',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Missing Permissions'),
    }) as any;

    await expect(
      action.execute('profile-1', { guildId: 'g', roleId: 'r' }),
    ).rejects.toThrow('Discord API failed: 403');
  });

  it('should throw if DISCORD_BOT_TOKEN not set', async () => {
    delete process.env.DISCORD_BOT_TOKEN;

    mockPrisma.socialLink.findUnique.mockResolvedValue({
      platformUserId: 'u',
      oauthTokenEncrypted: 'enc',
    });

    await expect(
      action.execute('profile-1', { guildId: 'g', roleId: 'r' }),
    ).rejects.toThrow('DISCORD_BOT_TOKEN not configured');
  });
});

// ─── IssuePoapAction ─────────────────────────────────────────────

describe('IssuePoapAction', () => {
  let action: IssuePoapAction;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        IssuePoapAction,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuiClientService, useValue: mockSuiClient },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              const map: Record<string, string> = {
                SUI_DRY_RUN: 'true',
                CRM_ACTION_PACKAGE_ID: '0xACTION',
              };
              return map[key] ?? def;
            },
          },
        },
      ],
    }).compile();

    action = module.get(IssuePoapAction);
  });

  it('should skip TX in dry-run mode', async () => {
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      primaryAddress: '0xABC',
    });

    await action.execute('profile-1', { poapTypeId: 'early-adopter' });

    expect(mockSuiClient.executeTransaction).not.toHaveBeenCalled();
  });

  it('should execute TX when not in dry-run', async () => {
    const module = await Test.createTestingModule({
      providers: [
        IssuePoapAction,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuiClientService, useValue: mockSuiClient },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              const map: Record<string, string> = {
                SUI_DRY_RUN: 'false',
                CRM_ACTION_PACKAGE_ID: '0xACTION',
              };
              return map[key] ?? def;
            },
          },
        },
      ],
    }).compile();

    const liveAction = module.get(IssuePoapAction);

    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({
      primaryAddress: '0xABC',
    });

    await liveAction.execute('profile-1', {});

    expect(mockSuiClient.executeTransaction).toHaveBeenCalled();
  });
});

// ─── AiGenerateContentAction ─────────────────────────────────────

describe('AiGenerateContentAction', () => {
  let action: AiGenerateContentAction;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AiGenerateContentAction,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmClientService, useValue: mockLlmClient },
      ],
    }).compile();

    action = module.get(AiGenerateContentAction);
  });

  it('should call LlmClientService.generate with prompt', async () => {
    mockLlmClient.generate.mockResolvedValue({
      text: 'Welcome to our DAO!',
      usage: { inputTokens: 100, outputTokens: 30 },
    });
    mockPrisma.workflowActionLog.findFirst.mockResolvedValue(null);

    await action.execute('profile-1', {
      prompt: 'DAO members who voted',
      workspaceId: 'ws-1',
      channel: 'discord',
      tone: 'friendly',
    });

    expect(mockLlmClient.generate).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        prompt: 'DAO members who voted',
      }),
    );

    // System prompt should contain channel and tone
    const callArgs = mockLlmClient.generate.mock.calls[0];
    expect(callArgs[1].system).toContain('discord');
    expect(callArgs[1].system).toContain('friendly');
  });

  it('should store generated content in action log metadata', async () => {
    mockLlmClient.generate.mockResolvedValue({
      text: 'Great content here',
      usage: { inputTokens: 50, outputTokens: 20 },
    });

    mockPrisma.workflowActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
    });

    await action.execute('profile-1', {
      prompt: 'Active users',
      workspaceId: 'ws-1',
    });

    expect(mockPrisma.workflowActionLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: {
        metadata: { content: 'Great content here' },
      },
    });
  });

  it('should use defaults for channel and tone', async () => {
    mockLlmClient.generate.mockResolvedValue({
      text: 'test content',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    mockPrisma.workflowActionLog.findFirst.mockResolvedValue(null);

    await action.execute('profile-1', {
      prompt: 'All users',
      workspaceId: 'ws-1',
    });

    const callArgs = mockLlmClient.generate.mock.calls[0];
    expect(callArgs[1].system).toContain('telegram');
    expect(callArgs[1].system).toContain('professional');
  });
});
