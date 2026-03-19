import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VaultPolicyService } from './vault-policy.service';
import { WalrusClient } from './walrus.client';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VaultController],
  providers: [
    VaultService,
    VaultPolicyService,
    WalrusClient,
    SuiClientService,
    TxBuilderService,
  ],
  exports: [VaultService, VaultPolicyService],
})
export class VaultModule {}
