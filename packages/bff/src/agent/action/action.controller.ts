import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ActionService } from './action.service';
import { SessionGuard } from '../../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
} from '../../auth/guards/rbac.guard';
import { AiRateLimitGuard } from '../guards/ai-rate-limit.guard';
import { User } from '../../auth/decorators/user.decorator';
import type { UserPayload } from '../../auth/auth.service';

export class PlanActionDto {
  @IsString()
  @IsNotEmpty()
  instruction: string;
}

export class ExecuteActionDto {
  @IsString()
  @IsNotEmpty()
  planId: string;
}

@Controller('agents/action')
@UseGuards(SessionGuard, RbacGuard, AiRateLimitGuard)
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Post('plan')
  @RequirePermissions(WRITE)
  async plan(@User() user: UserPayload, @Body() dto: PlanActionDto) {
    return this.actionService.planAction({
      workspaceId: user.workspaceId,
      userId: user.address,
      instruction: dto.instruction,
    });
  }

  @Post('execute')
  @RequirePermissions(WRITE)
  async execute(@User() user: UserPayload, @Body() dto: ExecuteActionDto) {
    await this.actionService.executeAction({
      workspaceId: user.workspaceId,
      userId: user.address,
      planId: dto.planId,
    });
    return { success: true };
  }
}
