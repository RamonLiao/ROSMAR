import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsNotEmpty, Allow } from 'class-validator';
import { SegmentService } from './segment.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE as DELETE_PERM } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';

export class CreateSegmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Allow()
  rules: any;
}

export class UpdateSegmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Allow()
  @IsOptional()
  rules?: any;

  @IsInt()
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
    @Body() dto: CreateSegmentDto,
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
    @Query('search') search?: string,
  ) {
    return this.segmentService.listSegments(
      user.workspaceId,
      limit || 50,
      offset || 0,
      search,
    );
  }

  @Put(':id')
  @RequirePermissions(WRITE)
  async update(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.segmentService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(DELETE_PERM)
  async remove(
    @Param('id') id: string,
  ) {
    return this.segmentService.delete(id);
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
