import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordOAuthAdapter } from './adapters/discord-oauth.adapter';
import { TelegramOAuthAdapter, TelegramLoginData } from './adapters/telegram-oauth.adapter';
import { XOAuthAdapter } from './adapters/x-oauth.adapter';
import { GoogleZkLoginAdapter } from './adapters/google-zklogin.adapter';
import { AppleZkLoginAdapter } from './adapters/apple-zklogin.adapter';
import * as crypto from 'crypto';

export type SocialPlatform = 'discord' | 'telegram' | 'x' | 'apple' | 'google';

interface OAuthState {
  profileId: string;
  platform: SocialPlatform;
  codeVerifier?: string; // for PKCE (X)
}

@Injectable()
export class SocialLinkService {
  private readonly encryptionKey: Buffer;
  // In-memory state store; production would use Redis
  private stateStore = new Map<string, OAuthState>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private discordAdapter: DiscordOAuthAdapter,
    private telegramAdapter: TelegramOAuthAdapter,
    private xAdapter: XOAuthAdapter,
    private googleAdapter: GoogleZkLoginAdapter,
    private appleAdapter: AppleZkLoginAdapter,
  ) {
    const keyHex = this.config.get<string>('SOCIAL_ENCRYPTION_KEY', '0'.repeat(64));
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  getAuthUrl(platform: SocialPlatform, profileId: string): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString('hex');

    if (platform === 'discord') {
      this.stateStore.set(state, { profileId, platform });
      return { url: this.discordAdapter.getAuthUrl(state), state };
    }

    if (platform === 'x') {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      this.stateStore.set(state, { profileId, platform, codeVerifier });
      return { url: this.xAdapter.getAuthUrl(state, codeChallenge), state };
    }

    throw new BadRequestException(`OAuth not supported for platform: ${platform}`);
  }

  async handleCallback(platform: SocialPlatform, code: string, state: string) {
    const stateData = this.stateStore.get(state);
    if (!stateData || stateData.platform !== platform) {
      throw new BadRequestException('Invalid or expired state');
    }
    this.stateStore.delete(state);

    let platformUserId: string;
    let platformUsername: string | null = null;
    let accessToken: string;

    if (platform === 'discord') {
      accessToken = await this.discordAdapter.exchangeCode(code);
      const user = await this.discordAdapter.getUserInfo(accessToken);
      platformUserId = user.id;
      platformUsername = user.username;
    } else if (platform === 'x') {
      accessToken = await this.xAdapter.exchangeCode(code, stateData.codeVerifier!);
      const user = await this.xAdapter.getUserInfo(accessToken);
      platformUserId = user.id;
      platformUsername = user.username;
    } else {
      throw new BadRequestException(`Callback not supported for platform: ${platform}`);
    }

    const encrypted = this.encryptToken(accessToken);

    return this.prisma.socialLink.upsert({
      where: {
        profileId_platform: {
          profileId: stateData.profileId,
          platform,
        },
      },
      create: {
        profileId: stateData.profileId,
        platform,
        platformUserId,
        platformUsername,
        oauthTokenEncrypted: encrypted,
        verified: true,
      },
      update: {
        platformUserId,
        platformUsername,
        oauthTokenEncrypted: encrypted,
        verified: true,
        linkedAt: new Date(),
      },
    });
  }

  async handleTelegramVerify(profileId: string, data: TelegramLoginData) {
    const isValid = this.telegramAdapter.verifyLoginWidget(data);
    if (!isValid) {
      throw new BadRequestException('Invalid Telegram login data');
    }

    const user = this.telegramAdapter.getUserInfo(data);

    const [link] = await this.prisma.$transaction([
      this.prisma.socialLink.upsert({
        where: {
          profileId_platform: { profileId, platform: 'telegram' },
        },
        create: {
          profileId,
          platform: 'telegram',
          platformUserId: user.id,
          platformUsername: user.username,
          verified: true,
        },
        update: {
          platformUserId: user.id,
          platformUsername: user.username,
          verified: true,
          linkedAt: new Date(),
        },
      }),
      this.prisma.profile.update({
        where: { id: profileId },
        data: { telegramChatId: user.id },
      }),
    ]);

    return link;
  }

  async linkGoogle(profileId: string, jwt: string) {
    const claims = this.googleAdapter.decodeJwt(jwt);
    if (!claims.sub) {
      throw new BadRequestException('Invalid Google JWT: missing sub claim');
    }

    return this.prisma.socialLink.upsert({
      where: {
        profileId_platform: { profileId, platform: 'google' },
      },
      create: {
        profileId,
        platform: 'google',
        platformUserId: claims.sub,
        platformUsername: claims.email ?? null,
        verified: true,
        metadata: {
          name: claims.name ?? null,
          picture: claims.picture ?? null,
        },
      },
      update: {
        platformUserId: claims.sub,
        platformUsername: claims.email ?? null,
        verified: true,
        linkedAt: new Date(),
        metadata: {
          name: claims.name ?? null,
          picture: claims.picture ?? null,
        },
      },
    });
  }

  async linkApple(profileId: string, jwtOrAddress: string) {
    // Support both JWT-based (new) and raw address (legacy) linking
    if (jwtOrAddress.includes('.')) {
      // JWT path
      const claims = this.appleAdapter.decodeJwt(jwtOrAddress);
      if (!claims.sub) {
        throw new BadRequestException('Invalid Apple JWT: missing sub claim');
      }

      return this.prisma.socialLink.upsert({
        where: {
          profileId_platform: { profileId, platform: 'apple' },
        },
        create: {
          profileId,
          platform: 'apple',
          platformUserId: claims.sub,
          platformUsername: claims.email ?? null,
          verified: true,
        },
        update: {
          platformUserId: claims.sub,
          platformUsername: claims.email ?? null,
          verified: true,
          linkedAt: new Date(),
        },
      });
    }

    // Legacy: raw zkLogin address
    return this.prisma.socialLink.upsert({
      where: {
        profileId_platform: { profileId, platform: 'apple' },
      },
      create: {
        profileId,
        platform: 'apple',
        platformUserId: jwtOrAddress,
        platformUsername: null,
        verified: true,
      },
      update: {
        platformUserId: jwtOrAddress,
        verified: true,
        linkedAt: new Date(),
      },
    });
  }

  async unlink(profileId: string, platform: SocialPlatform) {
    const link = await this.prisma.socialLink.findUnique({
      where: { profileId_platform: { profileId, platform } },
    });
    if (!link) {
      throw new NotFoundException(`No ${platform} link found for this profile`);
    }
    return this.prisma.socialLink.delete({
      where: { profileId_platform: { profileId, platform } },
    });
  }

  async getLinks(profileId: string) {
    return this.prisma.socialLink.findMany({
      where: { profileId },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        verified: true,
        linkedAt: true,
      },
    });
  }

  encryptToken(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decryptToken(encryptedStr: string): string {
    const [ivB64, tagB64, dataB64] = encryptedStr.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
