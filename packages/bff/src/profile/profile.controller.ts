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
import { CreateWalletDto } from './dto/wallet.dto';

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
  async getProfile(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getProfile(user.workspaceId, id);
  }

  @Get(':id/assets')
  async getAssets(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getAssets(user.workspaceId, id);
  }

  @Get(':id/timeline')
  async getTimeline(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.profileService.getTimeline(user.workspaceId, id, +limit, +offset);
  }

  @Get()
  async listProfiles(
    @User() user: import('../auth/auth.service').UserPayload,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
  ) {
    return this.profileService.listProfiles(
      user.workspaceId,
      limit || 50,
      offset || 0,
      search,
    );
  }

  @Get(':id/organizations')
  async getProfileOrganizations(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getProfileOrganizations(user.workspaceId, id);
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

  // ── Wallet endpoints ──────────────────────────────────────

  @Post(':id/wallets')
  @RequirePermissions(WRITE)
  async addWallet(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: CreateWalletDto,
  ) {
    return this.profileService.addWallet(user.workspaceId, id, dto);
  }

  @Get(':id/wallets')
  async listWallets(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.listWallets(user.workspaceId, id);
  }

  @Delete(':id/wallets/:walletId')
  @RequirePermissions(DELETE)
  async removeWallet(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Param('walletId') walletId: string,
  ) {
    return this.profileService.removeWallet(user.workspaceId, id, walletId);
  }

  @Get(':id/net-worth')
  async getNetWorth(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getNetWorth(user.workspaceId, id);
  }
}
