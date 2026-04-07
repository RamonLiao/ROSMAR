import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { SessionGuard } from '../../auth/guards/session.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { AiRateLimitGuard } from '../guards/ai-rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user';
import type { UserPayload } from '../../auth/auth.service';
import { AnalystService } from './analyst.service';

export class AnalystQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}

@Controller('agents/analyst')
@UseGuards(SessionGuard, RbacGuard, AiRateLimitGuard)
export class AnalystController {
  constructor(private readonly analystService: AnalystService) {}

  @Post('query')
  async query(
    @CurrentUser() user: UserPayload,
    @Body() dto: AnalystQueryDto,
  ) {
    return this.analystService.query({
      workspaceId: user.workspaceId,
      userId: user.address,
      query: dto.query,
    });
  }
}
