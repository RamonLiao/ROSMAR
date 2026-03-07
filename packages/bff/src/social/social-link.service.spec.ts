import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocialLinkService } from './social-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordOAuthAdapter } from './adapters/discord-oauth.adapter';
import { TelegramOAuthAdapter } from './adapters/telegram-oauth.adapter';
import { XOAuthAdapter } from './adapters/x-oauth.adapter';

describe('SocialLinkService', () => {
  let service: SocialLinkService;
  let prisma: {
    socialLink: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let discordAdapter: { getAuthUrl: jest.Mock; exchangeCode: jest.Mock; getUserInfo: jest.Mock };
  let telegramAdapter: { verifyLoginWidget: jest.Mock; getUserInfo: jest.Mock };
  let xAdapter: { getAuthUrl: jest.Mock; exchangeCode: jest.Mock; getUserInfo: jest.Mock };

  beforeEach(async () => {
    prisma = {
      socialLink: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    discordAdapter = {
      getAuthUrl: jest.fn().mockReturnValue('https://discord.com/oauth2?state=abc'),
      exchangeCode: jest.fn().mockResolvedValue('discord-token'),
      getUserInfo: jest.fn().mockResolvedValue({ id: 'discord-123', username: 'discorduser', avatar: null }),
    };

    telegramAdapter = {
      verifyLoginWidget: jest.fn().mockReturnValue(true),
      getUserInfo: jest.fn().mockReturnValue({ id: 'tg-123', username: 'tguser' }),
    };

    xAdapter = {
      getAuthUrl: jest.fn().mockReturnValue('https://x.com/oauth2?state=abc'),
      exchangeCode: jest.fn().mockResolvedValue('x-token'),
      getUserInfo: jest.fn().mockResolvedValue({ id: 'x-123', username: 'xuser' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SocialLinkService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: string) => {
              if (key === 'SOCIAL_ENCRYPTION_KEY') return 'a'.repeat(64); // 32-byte hex key
              return fallback;
            },
          },
        },
        { provide: DiscordOAuthAdapter, useValue: discordAdapter },
        { provide: TelegramOAuthAdapter, useValue: telegramAdapter },
        { provide: XOAuthAdapter, useValue: xAdapter },
      ],
    }).compile();

    service = module.get(SocialLinkService);
  });

  describe('getAuthUrl', () => {
    it('should return Discord auth URL with state', () => {
      const result = service.getAuthUrl('discord', 'profile-1');
      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();
      expect(discordAdapter.getAuthUrl).toHaveBeenCalled();
    });

    it('should return X auth URL with PKCE state', () => {
      const result = service.getAuthUrl('x', 'profile-1');
      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();
      expect(xAdapter.getAuthUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String), // codeChallenge
      );
    });

    it('should throw for unsupported platform', () => {
      expect(() => service.getAuthUrl('telegram', 'profile-1')).toThrow(BadRequestException);
    });
  });

  describe('handleCallback', () => {
    it('should exchange Discord code, encrypt token, and upsert link', async () => {
      const { state } = service.getAuthUrl('discord', 'profile-1');
      prisma.socialLink.upsert.mockResolvedValue({ id: 'link-1', platform: 'discord' });

      const result = await service.handleCallback('discord', 'auth-code', state);
      expect(discordAdapter.exchangeCode).toHaveBeenCalledWith('auth-code');
      expect(discordAdapter.getUserInfo).toHaveBeenCalledWith('discord-token');
      expect(prisma.socialLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId_platform: { profileId: 'profile-1', platform: 'discord' } },
          create: expect.objectContaining({
            platformUserId: 'discord-123',
            platformUsername: 'discorduser',
            verified: true,
          }),
        }),
      );
      expect(result).toEqual({ id: 'link-1', platform: 'discord' });
    });

    it('should reject invalid state', async () => {
      await expect(service.handleCallback('discord', 'code', 'bad-state')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleTelegramVerify', () => {
    it('should verify and create telegram link', async () => {
      prisma.socialLink.upsert.mockResolvedValue({ id: 'link-2', platform: 'telegram' });

      const data = { id: 'tg-123', first_name: 'Test', auth_date: 123, hash: 'abc' };
      const result = await service.handleTelegramVerify('profile-1', data);

      expect(telegramAdapter.verifyLoginWidget).toHaveBeenCalledWith(data);
      expect(prisma.socialLink.upsert).toHaveBeenCalled();
      expect(result.platform).toBe('telegram');
    });

    it('should reject invalid telegram data', async () => {
      telegramAdapter.verifyLoginWidget.mockReturnValue(false);
      const data = { id: 'tg-123', first_name: 'Test', auth_date: 123, hash: 'bad' };
      await expect(service.handleTelegramVerify('profile-1', data)).rejects.toThrow(BadRequestException);
    });
  });

  describe('linkApple', () => {
    it('should create apple link from zkLogin address', async () => {
      prisma.socialLink.upsert.mockResolvedValue({ id: 'link-3', platform: 'apple' });
      const result = await service.linkApple('profile-1', '0xabc123');
      expect(result.platform).toBe('apple');
      expect(prisma.socialLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            platform: 'apple',
            platformUserId: '0xabc123',
          }),
        }),
      );
    });
  });

  describe('unlink', () => {
    it('should delete social link', async () => {
      prisma.socialLink.findUnique.mockResolvedValue({ id: 'link-1' });
      prisma.socialLink.delete.mockResolvedValue({ id: 'link-1' });

      await service.unlink('profile-1', 'discord');
      expect(prisma.socialLink.delete).toHaveBeenCalledWith({
        where: { profileId_platform: { profileId: 'profile-1', platform: 'discord' } },
      });
    });

    it('should throw if link not found', async () => {
      prisma.socialLink.findUnique.mockResolvedValue(null);
      await expect(service.unlink('profile-1', 'discord')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLinks', () => {
    it('should return all links for profile', async () => {
      const links = [
        { id: '1', platform: 'discord', platformUserId: 'd1', platformUsername: 'user1', verified: true, linkedAt: new Date() },
      ];
      prisma.socialLink.findMany.mockResolvedValue(links);

      const result = await service.getLinks('profile-1');
      expect(result).toEqual(links);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt a token correctly', () => {
      const token = 'my-secret-token-12345';
      const encrypted = service.encryptToken(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = service.decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });
  });
});
