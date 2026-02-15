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
import { SegmentService } from './segment.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';

export class CreateSegmentDto {
  name: string;
  description?: string;
  rules: any; // JSONB structure
}

export class UpdateSegmentDto {
  name?: string;
  description?: string;
  rules?: any;
  expectedVersion: number;
}

@Controller('segments')
@UseGuards(SessionGuard, RbacGuard)
export class SegmentController {
  constructor(private readonly segmentService: SegmentService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./segment.controller').CreateSegmentDto,
  ) {
    return this.segmentService.create(
      user.workspaceId,
      user.address,
      dto,
    );
  }

  @Get(':id')
  async getSegment(@Param('id') id: string) {
    return this.segmentService.getSegment(id);
  }

  @Get(':id/profiles')
  async getSegmentProfiles(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.segmentService.evaluateSegment(
      id,
      limit || 100,
      offset || 0,
    );
  }

  @Get()
  async listSegments(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.segmentService.listSegments(
      user.workspaceId,
      limit || 50,
      offset || 0,
    );
  }

  @Put(':id')
  @RequirePermissions(WRITE)
  async update(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: import('./segment.controller').UpdateSegmentDto,
  ) {
    return this.segmentService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Post(':id/refresh')
  @RequirePermissions(WRITE)
  async refresh(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.segmentService.refreshSegment(
      user.workspaceId,
      user.address,
      id,
    );
  }
}
