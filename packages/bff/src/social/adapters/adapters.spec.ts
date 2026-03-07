import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TelegramOAuthAdapter, TelegramLoginData } from './telegram-oauth.adapter';
import { XOAuthAdapter } from './x-oauth.adapter';
import { AppleZkLoginAdapter } from './apple-zklogin.adapter';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('TelegramOAuthAdapter', () => {
  let adapter: TelegramOAuthAdapter;
  const botToken = 'test-bot-token-12345';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TelegramOAuthAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: string) =>
              key === 'TELEGRAM_BOT_TOKEN' ? botToken : fallback,
          },
        },
      ],
    }).compile();

    adapter = module.get(TelegramOAuthAdapter);
  });

  it('should verify valid Telegram login data', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const data: Omit<TelegramLoginData, 'hash'> = {
      id: '123456',
      first_name: 'Test',
      username: 'testuser',
      auth_date: authDate,
    };

    // Compute valid hash
    const checkString = Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    expect(adapter.verifyLoginWidget({ ...data, hash })).toBe(true);
  });

  it('should reject tampered data', () => {
    const data: TelegramLoginData = {
      id: '123456',
      first_name: 'Test',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'invalid-hash',
    };
    expect(adapter.verifyLoginWidget(data)).toBe(false);
  });

  it('should reject expired auth_date', () => {
    const oldDate = Math.floor(Date.now() / 1000) - 100000; // >1 day ago
    const data: Omit<TelegramLoginData, 'hash'> = {
      id: '123456',
      first_name: 'Test',
      auth_date: oldDate,
    };
    const checkString = Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    expect(adapter.verifyLoginWidget({ ...data, hash })).toBe(false);
  });

  it('should extract user info', () => {
    const data: TelegramLoginData = {
      id: '123456',
      first_name: 'Test',
      username: 'tguser',
      auth_date: 0,
      hash: '',
    };
    const user = adapter.getUserInfo(data);
    expect(user).toEqual({ id: '123456', username: 'tguser' });
  });
});

describe('XOAuthAdapter', () => {
  let adapter: XOAuthAdapter;

  beforeEach(async () => {
    mockFetch.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        XOAuthAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: string) => {
              const map: Record<string, string> = {
                X_CLIENT_ID: 'x-test-client',
                X_REDIRECT_URI: 'http://localhost:3001/api/social/x/callback',
              };
              return map[key] ?? fallback;
            },
          },
        },
      ],
    }).compile();

    adapter = module.get(XOAuthAdapter);
  });

  it('should generate auth URL with PKCE params', () => {
    const url = adapter.getAuthUrl('state-xyz', 'challenge-abc');
    expect(url).toContain('https://x.com/i/oauth2/authorize');
    expect(url).toContain('client_id=x-test-client');
    expect(url).toContain('code_challenge=challenge-abc');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=state-xyz');
  });

  it('should exchange code with PKCE verifier', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'x-access-token' }),
    });

    const token = await adapter.exchangeCode('code-123', 'verifier-abc');
    expect(token).toBe('x-access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.x.com/2/oauth2/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should throw on failed exchange', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'invalid_grant',
    });
    await expect(adapter.exchangeCode('bad', 'bad')).rejects.toThrow('X token exchange failed');
  });

  it('should fetch user info', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'x-user-1', username: 'xuser' } }),
    });

    const user = await adapter.getUserInfo('token');
    expect(user).toEqual({ id: 'x-user-1', username: 'xuser' });
  });
});

describe('AppleZkLoginAdapter', () => {
  let adapter: AppleZkLoginAdapter;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AppleZkLoginAdapter],
    }).compile();

    adapter = module.get(AppleZkLoginAdapter);
  });

  it('should validate correct Sui address', () => {
    const addr = '0x' + 'a'.repeat(64);
    expect(adapter.validateAddress(addr)).toBe(true);
  });

  it('should reject invalid address', () => {
    expect(adapter.validateAddress('0xshort')).toBe(false);
    expect(adapter.validateAddress('not-an-address')).toBe(false);
  });
});
