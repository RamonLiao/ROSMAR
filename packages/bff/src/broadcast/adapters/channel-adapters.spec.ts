import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramChannelAdapter } from './telegram-channel.adapter';
import { DiscordChannelAdapter } from './discord-channel.adapter';
import { XChannelAdapter } from './x-channel.adapter';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialLinkService } from '../../social/social-link.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Channel Adapters', () => {
  let config: Record<string, string>;

  beforeEach(() => {
    config = {
      TELEGRAM_BOT_TOKEN: 'tg-token',
      TELEGRAM_CHAT_ID: 'chat-123',
      DISCORD_BOT_TOKEN: 'dc-token',
      DISCORD_CHANNEL_ID: 'ch-456',
      X_BEARER_TOKEN: 'x-token',
    };
    mockFetch.mockReset();
  });

  function createConfigService(): ConfigService {
    return { get: (key: string) => config[key] } as any;
  }

  describe('TelegramChannelAdapter', () => {
    it('should send message via Telegram Bot API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: { message_id: 999 } }),
      });

      const adapter = new TelegramChannelAdapter(createConfigService());
      const result = await adapter.send('Hello', {});

      expect(result.messageId).toBe('999');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottg-token/sendMessage',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw if TELEGRAM_BOT_TOKEN is missing', async () => {
      delete config.TELEGRAM_BOT_TOKEN;
      const adapter = new TelegramChannelAdapter(createConfigService());
      await expect(adapter.send('Hello', {})).rejects.toThrow(
        'TELEGRAM_BOT_TOKEN not configured',
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });
      const adapter = new TelegramChannelAdapter(createConfigService());
      await expect(adapter.send('Hello', {})).rejects.toThrow(
        'Telegram API error: 400',
      );
    });
  });

  describe('DiscordChannelAdapter', () => {
    it('should send message via Discord API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg-789' }),
      });

      const adapter = new DiscordChannelAdapter(createConfigService());
      const result = await adapter.send('Hello', {});

      expect(result.messageId).toBe('msg-789');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/ch-456/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bot dc-token' }),
        }),
      );
    });

    it('should throw if DISCORD_BOT_TOKEN is missing', async () => {
      delete config.DISCORD_BOT_TOKEN;
      const adapter = new DiscordChannelAdapter(createConfigService());
      await expect(adapter.send('Hello', {})).rejects.toThrow(
        'DISCORD_BOT_TOKEN not configured',
      );
    });
  });

  describe('XChannelAdapter', () => {
    let mockPrisma: any;
    let mockSocialLinkService: any;

    beforeEach(() => {
      mockPrisma = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({ id: 'ws-1', ownerId: 'owner-1' }),
        },
        socialLink: {
          findUnique: jest.fn().mockResolvedValue({ oauthTokenEncrypted: 'enc-token' }),
        },
      };
      mockSocialLinkService = {
        decryptToken: jest.fn().mockReturnValue('decrypted-oauth-token'),
      };
    });

    it('should post tweet using decrypted OAuth token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'tweet-123' } }),
      });

      const adapter = new XChannelAdapter(
        createConfigService(),
        mockPrisma,
        mockSocialLinkService,
      );
      const result = await adapter.send('Hello X', { workspaceId: 'ws-1' });

      expect(result.messageId).toBe('tweet-123');
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
      });
      expect(mockPrisma.socialLink.findUnique).toHaveBeenCalledWith({
        where: {
          profileId_platform: { profileId: 'owner-1', platform: 'x' },
        },
      });
      expect(mockSocialLinkService.decryptToken).toHaveBeenCalledWith('enc-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer decrypted-oauth-token',
          }),
        }),
      );
    });

    it('should truncate content over 280 chars', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'tweet-456' } }),
      });

      const longContent = 'A'.repeat(300);
      const adapter = new XChannelAdapter(
        createConfigService(),
        mockPrisma,
        mockSocialLinkService,
      );
      await adapter.send(longContent, { workspaceId: 'ws-1' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toHaveLength(280);
      expect(body.text.endsWith('...')).toBe(true);
    });

    it('should throw if no workspaceId', async () => {
      const adapter = new XChannelAdapter(
        createConfigService(),
        mockPrisma,
        mockSocialLinkService,
      );
      await expect(adapter.send('Hello', {})).rejects.toThrow(
        'workspaceId is required for X channel',
      );
    });
  });

  describe('ChannelAdapterRegistry', () => {
    it('should register and retrieve all adapters', async () => {
      const module = await Test.createTestingModule({
        providers: [
          ChannelAdapterRegistry,
          TelegramChannelAdapter,
          DiscordChannelAdapter,
          XChannelAdapter,
          { provide: ConfigService, useValue: createConfigService() },
          { provide: PrismaService, useValue: {} },
          { provide: SocialLinkService, useValue: {} },
        ],
      }).compile();

      const registry = module.get(ChannelAdapterRegistry);

      expect(registry.get('telegram')).toBeInstanceOf(TelegramChannelAdapter);
      expect(registry.get('discord')).toBeInstanceOf(DiscordChannelAdapter);
      expect(registry.get('x')).toBeInstanceOf(XChannelAdapter);
      expect(registry.getAll()).toHaveLength(3);
    });

    it('should return undefined for unknown channel', async () => {
      const module = await Test.createTestingModule({
        providers: [
          ChannelAdapterRegistry,
          TelegramChannelAdapter,
          DiscordChannelAdapter,
          XChannelAdapter,
          { provide: ConfigService, useValue: createConfigService() },
          { provide: PrismaService, useValue: {} },
          { provide: SocialLinkService, useValue: {} },
        ],
      }).compile();

      const registry = module.get(ChannelAdapterRegistry);
      expect(registry.get('sms')).toBeUndefined();
    });
  });
});
