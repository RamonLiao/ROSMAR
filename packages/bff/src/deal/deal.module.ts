import { Module } from '@nestjs/common';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { DealDocumentService } from './deal-document.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { WalrusClient } from '../vault/walrus.client';

@Module({
  controllers: [DealController],
  providers: [
    DealService,
    DealDocumentService,
    SuiClientService,
    TxBuilderService,
    WalrusClient,
  ],
  exports: [DealService, DealDocumentService],
})
export class DealModule {}
