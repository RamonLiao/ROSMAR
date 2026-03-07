import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { WalrusClient } from './walrus.client';
import { SuiClientService } from '../blockchain/sui.client';

@Module({
  controllers: [VaultController],
  providers: [VaultService, WalrusClient, SuiClientService],
  exports: [VaultService],
})
export class VaultModule {}
