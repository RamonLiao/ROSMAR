import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { VaultService } from './vault.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

export class StoreSecretBodyDto {
  profileId: string;
  key: string;
  encryptedData: string; // base64
  sealPolicyId?: string;
  expiresAt?: string; // ISO date string
}

export class UpdateSecretBodyDto {
  encryptedData: string; // base64
  expectedVersion: number;
}

@Controller('vault')
@UseGuards(SessionGuard, RbacGuard)
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('secrets')
  @RequirePermissions(WRITE)
  async storeSecret(
    @User() user: UserPayload,
    @Body() dto: StoreSecretBodyDto,
  ) {
    return this.vaultService.storeSecret(
      user.workspaceId,
      user.address,
      {
        profileId: dto.profileId,
        key: dto.key,
        encryptedData: Buffer.from(dto.encryptedData, 'base64'),
        sealPolicyId: dto.sealPolicyId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    );
  }

  @Get('secrets/:profileId/:key')
  async getSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
  ) {
    return this.vaultService.getSecret(
      user.workspaceId,
      user.address,
      profileId,
      key,
    );
  }

  @Get('secrets/:profileId')
  async listSecrets(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
  ) {
    return this.vaultService.listSecrets(
      user.workspaceId,
      user.address,
      profileId,
    );
  }

  @Put('secrets/:profileId/:key')
  @RequirePermissions(WRITE)
  async updateSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSecretBodyDto,
  ) {
    return this.vaultService.updateSecret(
      user.workspaceId,
      user.address,
      profileId,
      key,
      {
        encryptedData: Buffer.from(dto.encryptedData, 'base64'),
        expectedVersion: dto.expectedVersion,
      },
    );
  }

  @Delete('secrets/:profileId/:key')
  @RequirePermissions(DELETE)
  async deleteSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.vaultService.deleteSecret(
      user.workspaceId,
      user.address,
      profileId,
      key,
      expectedVersion,
    );
  }

  @Get('secrets/:profileId/:key/audit')
  async getAuditLog(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
  ) {
    return this.vaultService.getAccessLog(
      user.workspaceId,
      profileId,
      key,
    );
  }
}
