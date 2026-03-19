import { Module } from '@nestjs/common';
import { SocialLinkService } from './social-link.service';
import { SocialLinkController } from './social-link.controller';
import { DiscordOAuthAdapter } from './adapters/discord-oauth.adapter';
import { TelegramOAuthAdapter } from './adapters/telegram-oauth.adapter';
import { XOAuthAdapter } from './adapters/x-oauth.adapter';
import { AppleZkLoginAdapter } from './adapters/apple-zklogin.adapter';
import { GoogleZkLoginAdapter } from './adapters/google-zklogin.adapter';
import { DiscordRoleSyncService } from './discord-role-sync.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SocialLinkController],
  providers: [
    SocialLinkService,
    DiscordOAuthAdapter,
    TelegramOAuthAdapter,
    XOAuthAdapter,
    AppleZkLoginAdapter,
    GoogleZkLoginAdapter,
    DiscordRoleSyncService,
  ],
  exports: [SocialLinkService, DiscordRoleSyncService],
})
export class SocialModule {}
