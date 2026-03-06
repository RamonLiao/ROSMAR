import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, READ } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('messaging')
@UseGuards(SessionGuard, RbacGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('send')
  @RequirePermissions(WRITE)
  async sendMessage(
    @User() user: UserPayload,
    @Body() body: any,
  ) {
    return this.messagingService.sendMessage(user.workspaceId, body);
  }

  @Get('history/:profileId')
  @RequirePermissions(READ)
  async getHistory(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
  ) {
    const messages = await this.prisma.message.findMany({
      where: { workspaceId: user.workspaceId, profileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { messages };
  }
}
