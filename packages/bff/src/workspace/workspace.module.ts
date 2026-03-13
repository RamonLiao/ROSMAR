import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { AuthModule } from '../auth/auth.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [AuthModule, SocialModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, SuiClientService, TxBuilderService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
