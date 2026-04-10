import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsNumber,
  IsArray,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import * as LookalikeTypes from './lookalike.service';
import { LookalikeService } from './lookalike.service';
import { SessionGuard } from '../../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
} from '../../auth/guards/rbac.guard';
import { User } from '../../auth/decorators/user.decorator';
import * as AuthTypes from '../../auth/auth.service';

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

  @IsString()
  @IsOptional()
  @IsIn(['knn-cosine', 'graph-based'])
  algorithm?: LookalikeTypes.Algorithm;

  @IsString()
  @IsOptional()
  @IsIn(['internal', 'on-chain-discovery'])
  candidateSource?: LookalikeTypes.CandidateMode;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  alpha?: number;
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
    @User() user: AuthTypes.UserPayload,
    @Param('id') segmentId: string,
    @Body() dto: FindLookalikeDto,
  ) {
    return this.lookalikeService.findLookalike(user.workspaceId, segmentId, {
      topK: dto.topK ?? 20,
      minSimilarity: dto.minSimilarity,
      algorithm: dto.algorithm,
      candidateSource: dto.candidateSource,
      alpha: dto.alpha,
    });
  }

  @Post(':id/lookalike/create-segment')
  @RequirePermissions(WRITE)
  async createSegmentFromResults(
    @User() user: AuthTypes.UserPayload,
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
