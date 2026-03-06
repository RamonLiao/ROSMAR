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
import { IsString, IsOptional, IsInt, IsIn, IsNumber } from 'class-validator';
import { VaultService } from './vault.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import type { UserPayload } from '../auth/auth.service';

export class StoreSecretDto {
  @IsString()
  profileId: string;

  @IsString()
  key: string;

  @IsString()
  encryptedData: string; // base64

  @IsIn(['note', 'file'])
  vaultType: 'note' | 'file';

  @IsOptional()
  @IsString()
  sealPolicyId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class UpdateSecretDto {
  @IsString()
  encryptedData: string; // base64

  @IsInt()
  expectedVersion: number;
}

export class DeleteSecretDto {
  @IsInt()
  expectedVersion: number;
}

@Controller('vault')
@UseGuards(SessionGuard, RbacGuard)
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('secrets')
  @RequirePermissions(WRITE)
  async storeSecret(@User() user: UserPayload, @Body() dto: StoreSecretDto) {
    return this.vaultService.storeSecret(user.workspaceId, user.address, dto);
  }

  @Get('secrets/:profileId/:key')
  async getSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
  ) {
    return this.vaultService.getSecret(user.workspaceId, user.address, profileId, key);
  }

  @Get('secrets/:profileId')
  async listSecrets(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
  ) {
    return this.vaultService.listSecrets(user.workspaceId, user.address, profileId);
  }

  @Put('secrets/:profileId/:key')
  @RequirePermissions(WRITE)
  async updateSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSecretDto,
  ) {
    return this.vaultService.updateSecret(user.workspaceId, user.address, profileId, key, dto);
  }

  @Delete('secrets/:profileId/:key')
  @RequirePermissions(DELETE)
  async deleteSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body() dto: DeleteSecretDto,
  ) {
    return this.vaultService.deleteSecret(
      user.workspaceId, user.address, profileId, key, dto.expectedVersion,
    );
  }
}
