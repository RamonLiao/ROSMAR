import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, WRITE, MANAGE } from '../auth/guards/rbac.guard';
import { RequirePermissions } from '../auth/decorators/permissions';
import { CurrentUser } from '../auth/decorators/current-user';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
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

@Controller('workspaces')
@UseGuards(SessionGuard, RbacGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

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
}
