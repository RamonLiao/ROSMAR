import { Module } from '@nestjs/common';
import { SegmentController } from './segment.controller';
import { SegmentService } from './segment.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [SegmentController],
  providers: [SegmentService, SuiClientService, TxBuilderService],
  exports: [SegmentService],
})
export class SegmentModule {}
