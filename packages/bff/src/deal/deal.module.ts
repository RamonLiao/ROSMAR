import { Module } from '@nestjs/common';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [DealController],
  providers: [DealService, SuiClientService, TxBuilderService],
  exports: [DealService],
})
export class DealModule {}
