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
import { ProfileService } from './profile.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';

export class CreateProfileDto {
  primaryAddress: string;
  suinsName?: string;
  tags?: string[];
}

export class UpdateProfileDto {
  suinsName?: string;
  tags?: string[];
  expectedVersion: number;
}

@Controller('profiles')
@UseGuards(SessionGuard, RbacGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./profile.controller').CreateProfileDto,
  ) {
    return this.profileService.create(
      user.workspaceId,
      user.address,
      dto,
    );
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Get()
  async listProfiles(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.profileService.listProfiles(
      user.workspaceId,
      limit || 50,
      offset || 0,
    );
  }

  @Put(':id/tags')
  @RequirePermissions(WRITE)
  async updateTags(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: import('./profile.controller').UpdateProfileDto,
  ) {
    return this.profileService.updateTags(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(DELETE)
  async archive(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.profileService.archive(
      user.workspaceId,
      user.address,
      id,
      expectedVersion,
    );
  }
}
