import { Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@User() user: UserPayload) {
    return this.notificationService.list(user.workspaceId, user.address);
  }

  @Get('unread-count')
  async unreadCount(@User() user: UserPayload) {
    const count = await this.notificationService.getUnreadCount(
      user.workspaceId,
      user.address,
    );
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationService.markRead(id);
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllRead(@User() user: UserPayload) {
    await this.notificationService.markAllRead(user.workspaceId, user.address);
    return { success: true };
  }
}
