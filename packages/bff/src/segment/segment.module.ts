import { Module } from '@nestjs/common';
import { SegmentController } from './segment.controller';
import { SegmentService } from './segment.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { AuthModule } from '../auth/auth.module';
import { LookalikeController } from './lookalike/lookalike.controller';
import { LookalikeService } from './lookalike/lookalike.service';
import { FeatureExtractionService } from './lookalike/feature-extraction.service';
import { InternalCandidateSource } from './lookalike/sources/internal.source';
import { OnChainCandidateSource } from './lookalike/sources/on-chain.source';
import { GraphBasedStrategy } from './lookalike/strategies/graph-based.strategy';
import { RuleEvaluatorService } from './evaluator/rule-evaluator.service';

@Module({
  imports: [AuthModule],
  controllers: [SegmentController, LookalikeController],
  providers: [
    SegmentService,
    SuiClientService,
    TxBuilderService,
    LookalikeService,
    FeatureExtractionService,
    InternalCandidateSource,
    OnChainCandidateSource,
    GraphBasedStrategy,
    RuleEvaluatorService,
  ],
  exports: [SegmentService, RuleEvaluatorService],
})
export class SegmentModule {}
