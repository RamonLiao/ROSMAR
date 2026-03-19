import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { WalletClusterController } from './wallet-cluster.controller';
import { ProfileService } from './profile.service';
import { WalletClusterService } from './wallet-cluster.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { EvmResolverService } from '../blockchain/evm-resolver.service';
import { SolanaResolverService } from '../blockchain/solana-resolver.service';
import { SuinsService } from '../blockchain/suins.service';
import { BalanceAggregatorService } from '../blockchain/balance-aggregator.service';
import { DefiPositionService } from '../blockchain/defi-position.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, BlockchainModule],
  controllers: [ProfileController, WalletClusterController],
  providers: [
    ProfileService,
    WalletClusterService,
    SuiClientService,
    TxBuilderService,
    EvmResolverService,
    SolanaResolverService,
    BalanceAggregatorService,
    DefiPositionService,
    SuinsService,
  ],
  exports: [ProfileService],
})
export class ProfileModule {}
