import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, SuiClientService, TxBuilderService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
