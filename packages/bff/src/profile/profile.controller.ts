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
import { WalletClusterService } from './wallet-cluster.service';
import { CacheService } from '../common/cache/cache.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';
import { CreateWalletDto } from './dto/wallet.dto';
import { MergeProfileDto } from './dto/merge-profile.dto';

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
  constructor(
    private readonly profileService: ProfileService,
    private readonly walletClusterService: WalletClusterService,
    private readonly cacheService: CacheService,
  ) {}

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

  @Get(':id/summary')
  async getSummary(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    const cacheKey = `profile-summary:${user.workspaceId}:${id}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const summary = await this.profileService.getSummary(user.workspaceId, id);
    await this.cacheService.set(cacheKey, summary, 60);
    return summary;
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

  // ── Merge endpoints ──────────────────────────────────────

  @Get(':id/funding-patterns')
  async getFundingPatterns(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    const clusters = await this.walletClusterService.detectFundingPatterns(
      user.workspaceId,
      id,
    );
    return { clusters };
  }

  @Get(':id/merge-candidates')
  async getMergeCandidates(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    const candidate = await this.walletClusterService.detectMergeCandidate(
      user.workspaceId,
      id,
    );
    return { candidate };
  }

  @Post(':id/merge')
  @RequirePermissions(WRITE)
  async mergeProfile(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
    @Body() dto: MergeProfileDto,
  ) {
    return this.walletClusterService.mergeProfiles(
      user.workspaceId,
      id,
      dto.sourceProfileId,
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

  @Post(':id/resolve-avatar')
  @RequirePermissions(WRITE)
  async resolveAvatar(
    @Param('id') id: string,
  ) {
    const avatarUrl = await this.profileService.resolveAndUpdateAvatar(id);
    return { avatarUrl };
  }

  @Get(':id/nft-traits')
  async getNftTraits(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    const nfts = await this.profileService.fetchNftWithTraits(user.workspaceId, id);
    return { nfts };
  }

  @Get(':id/defi-positions')
  async getDefiPositions(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getDefiPositions(user.workspaceId, id);
  }

  @Get(':id/net-worth')
  async getNetWorth(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getNetWorth(user.workspaceId, id);
  }

  // ── Domain endpoints ──────────────────────────────────────

  @Get(':id/domains')
  async getDomains(@Param('id') id: string) {
    const domains = await this.profileService.getAvailableDomains(id);
    return { domains };
  }

  @Put(':id/primary-domain')
  @RequirePermissions(WRITE)
  async setPrimaryDomain(
    @Param('id') id: string,
    @Body() body: { domain: string },
  ) {
    await this.profileService.setPrimaryDomain(id, body.domain);
    return { success: true };
  }
}
