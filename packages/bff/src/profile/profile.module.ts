import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, SuiClientService, TxBuilderService],
  exports: [ProfileService],
})
export class ProfileModule {}
