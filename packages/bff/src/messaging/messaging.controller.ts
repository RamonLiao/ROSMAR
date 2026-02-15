import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

@Controller('messaging')
@UseGuards(SessionGuard, RbacGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('send')
  @RequirePermissions(WRITE)
  async sendMessage(
    @User() user: UserPayload,
    @Body() body: any,
  ) {
    return this.messagingService.sendMessage(user.workspaceId, body);
  }
}
