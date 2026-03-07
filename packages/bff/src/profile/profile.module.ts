import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { EvmResolverService } from '../blockchain/evm-resolver.service';
import { SolanaResolverService } from '../blockchain/solana-resolver.service';
import { BalanceAggregatorService } from '../blockchain/balance-aggregator.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, BlockchainModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    SuiClientService,
    TxBuilderService,
    EvmResolverService,
    SolanaResolverService,
    BalanceAggregatorService,
  ],
  exports: [ProfileService],
})
export class ProfileModule {}
