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
import { DealService } from './deal.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';

export class CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
}

export class UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  expectedVersion: number;
}

@Controller('deals')
@UseGuards(SessionGuard, RbacGuard)
export class DealController {
  constructor(private readonly dealService: DealService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./deal.controller').CreateDealDto,
  ) {
    return this.dealService.create(
      user.workspaceId,
      user.address,
      dto,
    );
  }

  @Get(':id')
  async getDeal(@Param('id') id: string) {
    return this.dealService.getDeal(id);
  }

  @Get()
  async listDeals(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('profileId') profileId?: string,
    @Query('stage') stage?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.dealService.listDeals(
      user.workspaceId,
      profileId,
      stage,
      limit || 50,
      offset || 0,
    );
  }

  @Put(':id')
  @RequirePermissions(WRITE)
  async update(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: import('./deal.controller').UpdateDealDto,
  ) {
    return this.dealService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Put(':id/stage')
  @RequirePermissions(WRITE)
  async updateStage(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body('stage') stage: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.dealService.updateStage(
      user.workspaceId,
      user.address,
      id,
      stage,
      expectedVersion,
    );
  }
}
