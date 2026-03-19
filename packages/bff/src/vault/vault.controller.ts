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
import { VaultPolicyService } from './vault-policy.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
// UserPayload used inline as import() type in decorated params to avoid isolatedModules error

export class StoreSecretBodyDto {
  profileId: string;
  key: string;
  encryptedData: string; // base64
  sealPolicyId?: string;
  expiresAt?: string; // ISO date string
  releaseAt?: string; // ISO date string — secret locked until this time
}

export class UpdateSecretBodyDto {
  encryptedData: string; // base64
  expectedVersion: number;
}

@Controller('vault')
@UseGuards(SessionGuard, RbacGuard)
export class VaultController {
  constructor(
    private readonly vaultService: VaultService,
    private readonly policyService: VaultPolicyService,
  ) {}

  @Post('policies')
  @RequirePermissions(WRITE)
  async createPolicy(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body()
    body: {
      name: string;
      ruleType: 0 | 1 | 2;
      allowedAddresses?: string[];
      minRoleLevel?: number;
      expiresAtMs?: string;
    },
  ) {
    return this.policyService.createPolicy(user.workspaceId, body);
  }

  @Post('secrets')
  @RequirePermissions(WRITE)
  async storeSecret(
    @User() user: import('../auth/auth.service').UserPayload,
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
        releaseAt: dto.releaseAt ? new Date(dto.releaseAt) : undefined,
      },
    );
  }

  @Get('secrets/:profileId/:key')
  async getSecret(
    @User() user: import('../auth/auth.service').UserPayload,
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
    @User() user: import('../auth/auth.service').UserPayload,
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
    @User() user: import('../auth/auth.service').UserPayload,
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
    @User() user: import('../auth/auth.service').UserPayload,
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

  @Post('secrets/:profileId/:key/release')
  @RequirePermissions(WRITE)
  async releaseSecret(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
  ) {
    await this.vaultService.releaseSecret(user.workspaceId, profileId, key);
    return { success: true };
  }

  @Get('secrets/:profileId/:key/audit')
  async getAuditLog(
    @User() user: import('../auth/auth.service').UserPayload,
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
