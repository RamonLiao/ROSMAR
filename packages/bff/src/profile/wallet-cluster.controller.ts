import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WalletClusterService } from './wallet-cluster.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';
import { ClaimAddressDto } from './dto/claim-address.dto';

@Controller('profiles/:profileId/wallets')
@UseGuards(SessionGuard, RbacGuard)
export class WalletClusterController {
  constructor(private readonly walletCluster: WalletClusterService) {}

  @Post('claim')
  @RequirePermissions(WRITE)
  async claim(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('profileId') profileId: string,
    @Body() dto: ClaimAddressDto,
  ) {
    return this.walletCluster.claimAddress(
      user.workspaceId,
      profileId,
      dto.address,
      dto.message,
      dto.signature,
    );
  }

  @Get()
  async listVerified(@Param('profileId') profileId: string) {
    return this.walletCluster.getClusterForProfile(profileId);
  }
}
