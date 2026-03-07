import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SocialLinkService } from './social-link.service';

@Controller('social')
export class SocialLinkController {
  constructor(private socialLinkService: SocialLinkService) {}

  // --- Discord ---
  @Get('discord/auth-url')
  getDiscordAuthUrl(@Query('profileId') profileId: string) {
    if (!profileId) throw new BadRequestException('profileId required');
    const { url } = this.socialLinkService.getAuthUrl('discord', profileId);
    return { url };
  }

  @Get('discord/callback')
  async handleDiscordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code || !state) throw new BadRequestException('code and state required');
    const link = await this.socialLinkService.handleCallback('discord', code, state);
    return { success: true, link };
  }

  // --- X (Twitter) ---
  @Get('x/auth-url')
  getXAuthUrl(@Query('profileId') profileId: string) {
    if (!profileId) throw new BadRequestException('profileId required');
    const { url } = this.socialLinkService.getAuthUrl('x', profileId);
    return { url };
  }

  @Get('x/callback')
  async handleXCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code || !state) throw new BadRequestException('code and state required');
    const link = await this.socialLinkService.handleCallback('x', code, state);
    return { success: true, link };
  }

  // --- Telegram ---
  @Post('telegram/verify')
  async verifyTelegram(
    @Query('profileId') profileId: string,
    @Body() data: Record<string, unknown>,
  ) {
    if (!profileId) throw new BadRequestException('profileId required');
    const link = await this.socialLinkService.handleTelegramVerify(profileId, data as any);
    return { success: true, link };
  }

  // --- Apple ---
  @Post(':profileId/apple')
  async linkApple(
    @Param('profileId') profileId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (!body.zkLoginAddress) throw new BadRequestException('zkLoginAddress required');
    const link = await this.socialLinkService.linkApple(profileId, body.zkLoginAddress as string);
    return { success: true, link };
  }

  // --- Generic ---
  @Get(':profileId/links')
  async getLinks(@Param('profileId') profileId: string) {
    const links = await this.socialLinkService.getLinks(profileId);
    return { links };
  }

  @Delete(':profileId/:platform')
  async unlink(
    @Param('profileId') profileId: string,
    @Param('platform') platform: string,
  ) {
    await this.socialLinkService.unlink(profileId, platform as any);
    return { success: true };
  }
}
