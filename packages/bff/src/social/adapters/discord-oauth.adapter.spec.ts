import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscordOAuthAdapter } from './discord-oauth.adapter';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('DiscordOAuthAdapter', () => {
  let adapter: DiscordOAuthAdapter;

  beforeEach(async () => {
    mockFetch.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        DiscordOAuthAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: string) => {
              const map: Record<string, string> = {
                DISCORD_CLIENT_ID: 'test-client-id',
                DISCORD_CLIENT_SECRET: 'test-secret',
                DISCORD_REDIRECT_URI:
                  'http://localhost:3001/api/social/discord/callback',
              };
              return map[key] ?? fallback;
            },
          },
        },
      ],
    }).compile();

    adapter = module.get(DiscordOAuthAdapter);
  });

  describe('getAuthUrl', () => {
    it('should return Discord authorize URL with correct params', () => {
      const url = adapter.getAuthUrl('state-123');
      expect(url).toContain('https://discord.com/api/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=identify+guilds');
      expect(url).toContain('state=state-123');
      expect(url).toContain('response_type=code');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code for access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'discord-token-abc' }),
      });

      const token = await adapter.exchangeCode('auth-code-123');
      expect(token).toBe('discord-token-abc');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/oauth2/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(adapter.exchangeCode('bad-code')).rejects.toThrow(
        'Discord token exchange failed',
      );
    });
  });

  describe('getUserInfo', () => {
    it('should return user info from Discord API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '123456',
          username: 'testuser',
          avatar: 'abc123',
        }),
      });

      const user = await adapter.getUserInfo('token-abc');
      expect(user).toEqual({
        id: '123456',
        username: 'testuser',
        avatar: 'abc123',
      });
    });

    it('should throw on failed user info fetch', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      await expect(adapter.getUserInfo('bad-token')).rejects.toThrow(
        'Failed to fetch Discord user info',
      );
    });
  });
});
