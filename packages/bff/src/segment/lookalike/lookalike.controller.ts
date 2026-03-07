import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsNumber, IsArray, IsString, Min, Max } from 'class-validator';
import { LookalikeService } from './lookalike.service';
import { SessionGuard } from '../../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../../auth/guards/rbac.guard';
import { User } from '../../auth/decorators/user.decorator';

export class FindLookalikeDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(500)
  topK?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  minSimilarity?: number;
}

export class CreateSegmentFromResultsDto {
  @IsArray()
  @IsString({ each: true })
  profileIds: string[];
}

@Controller('segments')
@UseGuards(SessionGuard, RbacGuard)
export class LookalikeController {
  constructor(private readonly lookalikeService: LookalikeService) {}

  @Post(':id/lookalike')
  @RequirePermissions(WRITE)
  async findLookalike(
    @User() user: import('../../auth/auth.service').UserPayload,
    @Param('id') segmentId: string,
    @Body() dto: FindLookalikeDto,
  ) {
    return this.lookalikeService.findLookalike(
      user.workspaceId,
      segmentId,
      {
        topK: dto.topK ?? 20,
        minSimilarity: dto.minSimilarity,
      },
    );
  }

  @Post(':id/lookalike/create-segment')
  @RequirePermissions(WRITE)
  async createSegmentFromResults(
    @User() user: import('../../auth/auth.service').UserPayload,
    @Param('id') segmentId: string,
    @Body() dto: CreateSegmentFromResultsDto,
  ) {
    return this.lookalikeService.createSegmentFromResults(
      user.workspaceId,
      segmentId,
      dto.profileIds,
    );
  }
}
