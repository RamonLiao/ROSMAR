import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
} from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';
import {
  CreateBroadcastDto,
  UpdateBroadcastDto,
  ScheduleBroadcastDto,
} from './dto/broadcast.dto';

@Controller('broadcasts')
@UseGuards(SessionGuard, RbacGuard)
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(@User() user: UserPayload, @Body() dto: CreateBroadcastDto) {
    return this.broadcastService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateBroadcastDto) {
    return this.broadcastService.update(id, dto);
  }

  @Post(':id/send')
  @RequirePermissions(WRITE)
  async send(@Param('id') id: string) {
    await this.broadcastService.send(id);
    return { success: true };
  }

  @Post(':id/schedule')
  @RequirePermissions(WRITE)
  async schedule(@Param('id') id: string, @Body() dto: ScheduleBroadcastDto) {
    return this.broadcastService.schedule(id, new Date(dto.scheduledAt));
  }

  @Get()
  async list(@User() user: UserPayload) {
    return this.broadcastService.list(user.workspaceId);
  }

  @Get(':id/analytics')
  async analytics(@Param('id') id: string) {
    return this.broadcastService.getAnalytics(id);
  }
}
