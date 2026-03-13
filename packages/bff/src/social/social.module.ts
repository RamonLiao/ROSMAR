import { Module } from '@nestjs/common';
import { SocialLinkService } from './social-link.service';
import { SocialLinkController } from './social-link.controller';
import { DiscordOAuthAdapter } from './adapters/discord-oauth.adapter';
import { TelegramOAuthAdapter } from './adapters/telegram-oauth.adapter';
import { XOAuthAdapter } from './adapters/x-oauth.adapter';
import { AppleZkLoginAdapter } from './adapters/apple-zklogin.adapter';
import { DiscordRoleSyncService } from './discord-role-sync.service';

@Module({
  controllers: [SocialLinkController],
  providers: [
    SocialLinkService,
    DiscordOAuthAdapter,
    TelegramOAuthAdapter,
    XOAuthAdapter,
    AppleZkLoginAdapter,
    DiscordRoleSyncService,
  ],
  exports: [SocialLinkService, DiscordRoleSyncService],
})
export class SocialModule {}
