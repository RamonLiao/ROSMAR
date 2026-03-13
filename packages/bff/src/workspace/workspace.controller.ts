import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { DiscordRoleSyncService } from '../social/discord-role-sync.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, WRITE, MANAGE } from '../auth/guards/rbac.guard';
import { RequirePermissions } from '../auth/decorators/permissions';
import { CurrentUser } from '../auth/decorators/current-user';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import type { EngagementWeights } from '../engagement/engagement.constants';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  roleLevel: number;

  @IsNumber()
  permissions: number;
}

export class EngagementWeightsDto {
  @IsNumber()
  holdTime: number;

  @IsNumber()
  txCount: number;

  @IsNumber()
  txValue: number;

  @IsNumber()
  voteCount: number;

  @IsNumber()
  nftCount: number;
}

@Controller('workspaces')
@UseGuards(SessionGuard, RbacGuard)
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly discordRoleSyncService: DiscordRoleSyncService,
  ) {}

  @Post()
  async createWorkspace(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser('address') address: string,
  ) {
    return this.workspaceService.createWorkspace(dto.name, address);
  }

  @Get()
  async listWorkspaces(@CurrentUser('address') address: string) {
    return this.workspaceService.listUserWorkspaces(address);
  }

  @Get(':id')
  async getWorkspace(@Param('id') id: string) {
    return this.workspaceService.getWorkspace(id);
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async updateWorkspace(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(id, dto);
  }

  @Get(':id/members')
  async listMembers(@Param('id') workspaceId: string) {
    return this.workspaceService.listMembers(workspaceId);
  }

  @Post(':id/members')
  @RequirePermissions(MANAGE)
  async addMember(
    @Param('id') workspaceId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.workspaceService.addMember(
      workspaceId,
      dto.address,
      dto.roleLevel,
      dto.permissions,
    );
  }

  @Delete(':id/members/:address')
  @RequirePermissions(MANAGE)
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('address') address: string,
  ) {
    return this.workspaceService.removeMember(workspaceId, address);
  }

  @Get(':id/engagement-weights')
  async getEngagementWeights(@Param('id') workspaceId: string) {
    return this.workspaceService.getEngagementWeights(workspaceId);
  }

  @Get(':id/discord-roles')
  async getDiscordRoles(@Param('id') id: string) {
    const workspace = await this.workspaceService.getWorkspace(id);
    if (!workspace?.discordGuildId) {
      return { roles: [], guildId: null };
    }

    const roles = await this.discordRoleSyncService.fetchGuildRoles(workspace.discordGuildId);
    return {
      guildId: workspace.discordGuildId,
      roles: roles
        .filter((r: any) => r.name !== '@everyone')
        .sort((a: any, b: any) => b.position - a.position)
        .map((r: any) => ({ id: r.id, name: r.name })),
    };
  }

  @Put(':id/engagement-weights')
  @RequirePermissions(WRITE)
  async setEngagementWeights(
    @Param('id') workspaceId: string,
    @Body() weights: EngagementWeightsDto,
  ) {
    return this.workspaceService.setEngagementWeights(workspaceId, weights);
  }
}
