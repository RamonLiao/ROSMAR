import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

export class CreateCampaignDto {
  name: string;
  description?: string;
  segmentId: string;
  workflowSteps: any[]; // Array of workflow step definitions
}

export class UpdateCampaignDto {
  name?: string;
  description?: string;
  status?: string;
  workflowSteps?: any[];
  expectedVersion: number;
}

@Controller('campaigns')
@UseGuards(SessionGuard, RbacGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./campaign.controller').CreateCampaignDto,
  ) {
    return this.campaignService.create(
      user.workspaceId,
      user.address,
      dto,
    );
  }

  @Get(':id')
  async getCampaign(@Param('id') id: string) {
    return this.campaignService.getCampaign(id);
  }

  @Get()
  async listCampaigns(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.campaignService.listCampaigns(
      user.workspaceId,
      status,
      limit || 50,
      offset || 0,
    );
  }

  @Put(':id')
  @RequirePermissions(WRITE)
  async update(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: import('./campaign.controller').UpdateCampaignDto,
  ) {
    return this.campaignService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Post(':id/start')
  @RequirePermissions(WRITE)
  async start(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.campaignService.startCampaign(
      user.workspaceId,
      user.address,
      id,
    );
  }

  @Post(':id/pause')
  @RequirePermissions(WRITE)
  async pause(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.campaignService.pauseCampaign(
      user.workspaceId,
      user.address,
      id,
    );
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.campaignService.getCampaignStats(id);
  }
}
