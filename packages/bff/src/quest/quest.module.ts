import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { QuestVerificationService } from './quest-verification.service';
import { IndexerVerifier } from './verifiers/indexer.verifier';
import { RpcVerifier } from './verifiers/rpc.verifier';
import { ManualVerifier } from './verifiers/manual.verifier';

@Module({
  imports: [AuthModule],
  controllers: [QuestController],
  providers: [
    QuestService,
    QuestVerificationService,
    IndexerVerifier,
    RpcVerifier,
    ManualVerifier,
  ],
  exports: [QuestService],
})
export class QuestModule {}
