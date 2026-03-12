import { Module } from '@nestjs/common';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { DealDocumentService } from './deal-document.service';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { SaftTemplateService } from './saft-template.service';
import { SaftTemplateController } from './saft-template.controller';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { WalrusClient } from '../vault/walrus.client';
import { DealEventListener } from './deal-event.listener';
import { DealRoomGuard } from './deal-room.guard';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [DealController, EscrowController, SaftTemplateController],
  providers: [
    DealService,
    DealDocumentService,
    EscrowService,
    SaftTemplateService,
    SuiClientService,
    TxBuilderService,
    WalrusClient,
    DealEventListener,
    DealRoomGuard,
  ],
  exports: [DealService, DealDocumentService, EscrowService],
})
export class DealModule {}
