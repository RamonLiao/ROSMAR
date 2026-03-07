import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IsString, IsIn, IsNotEmpty } from 'class-validator';
import { ContentService, type ContentChannel } from './content.service';
import { SessionGuard } from '../../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../../auth/guards/rbac.guard';
import { User } from '../../auth/decorators/user.decorator';
import type { UserPayload } from '../../auth/auth.service';

export class GenerateContentDto {
  @IsString()
  @IsNotEmpty()
  segmentDescription: string;

  @IsString()
  @IsIn(['telegram', 'discord', 'email', 'x'])
  channel: ContentChannel;

  @IsString()
  @IsNotEmpty()
  tone: string;
}

@Controller('agents/content')
@UseGuards(SessionGuard, RbacGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('generate')
  @RequirePermissions(WRITE)
  async generate(
    @User() user: UserPayload,
    @Body() dto: GenerateContentDto,
  ) {
    return this.contentService.generateContent({
      workspaceId: user.workspaceId,
      userId: user.address,
      segmentDescription: dto.segmentDescription,
      channel: dto.channel,
      tone: dto.tone,
    });
  }
}
