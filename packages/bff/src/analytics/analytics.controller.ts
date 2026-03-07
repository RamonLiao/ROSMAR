import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('analytics')
@UseGuards(SessionGuard, RbacGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('score-distribution')
  async scoreDistribution(
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.analyticsService.getScoreDistribution(user.workspaceId);
  }

  @Get('profiles/:id/score')
  async getScoreBreakdown(@Param('id') profileId: string) {
    return this.analyticsService.getScoreBreakdown(profileId);
  }

  @Get('activity-heatmap')
  async activityHeatmap(
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.analyticsService.getActivityHeatmap(user.workspaceId);
  }

  @Get('pipeline-summary')
  async pipelineSummary(
    @User() user: import('../auth/auth.service').UserPayload,
  ) {
    return this.analyticsService.getPipelineSummary(user.workspaceId);
  }
}
