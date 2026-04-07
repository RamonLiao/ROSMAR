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
import { OrganizationService } from './organization.service';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
  DELETE,
} from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';

export class CreateOrganizationDto {
  name: string;
  domain?: string;
  tags?: string[];
}

export class UpdateOrganizationDto {
  name?: string;
  domain?: string;
  tags?: string[];
  expectedVersion: number;
}

@Controller('organizations')
@UseGuards(SessionGuard, RbacGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./organization.controller').CreateOrganizationDto,
  ) {
    return this.organizationService.create(user.workspaceId, user.address, dto);
  }

  @Get(':id')
  async getOrganization(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.organizationService.getOrganization(user.workspaceId, id);
  }

  @Get()
  async listOrganizations(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
  ) {
    return this.organizationService.listOrganizations(
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
    @Body() dto: import('./organization.controller').UpdateOrganizationDto,
  ) {
    return this.organizationService.update(
      user.workspaceId,
      user.address,
      id,
      dto,
    );
  }

  @Post(':orgId/profiles/:profileId')
  @RequirePermissions(WRITE)
  async linkProfile(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('orgId') orgId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.organizationService.linkProfile(
      user.workspaceId,
      user.address,
      orgId,
      profileId,
    );
  }

  @Get(':id/profiles')
  async getOrganizationProfiles(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.organizationService.getOrganizationProfiles(
      user.workspaceId,
      id,
    );
  }

  @Delete(':orgId/profiles/:profileId')
  @RequirePermissions(DELETE)
  async unlinkProfile(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('orgId') orgId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.organizationService.unlinkProfile(
      user.workspaceId,
      orgId,
      profileId,
    );
  }
}
