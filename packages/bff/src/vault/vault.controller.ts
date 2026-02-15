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
import { VaultService } from './vault.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';

export class StoreSecretDto {
  profileId: string;
  key: string;
  encryptedData: Buffer;
}

export class UpdateSecretDto {
  encryptedData: Buffer;
  expectedVersion: number;
}

@Controller('vault')
@UseGuards(SessionGuard, RbacGuard)
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('secrets')
  @RequirePermissions(WRITE)
  async storeSecret(
    @User() user: import('../auth/auth.service').UserPayload,
    @Body() dto: import('./vault.controller').StoreSecretDto,
  ) {
    return this.vaultService.storeSecret(
      user.workspaceId,
      user.address,
      dto,
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
    @Body() dto: import('./vault.controller').UpdateSecretDto,
  ) {
    return this.vaultService.updateSecret(
      user.workspaceId,
      user.address,
      profileId,
      key,
      dto,
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
}
