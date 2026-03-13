import { Module } from '@nestjs/common';
import { SponsorController } from './sponsor.controller';
import { EnokiSponsorService } from './enoki-sponsor.service';
import { SuiClientService } from './sui.client';
import { GasSponsorListener } from './gas-sponsor.listener';
import { EvmResolverService } from './evm-resolver.service';
import { SolanaResolverService } from './solana-resolver.service';
import { BalanceAggregatorService } from './balance-aggregator.service';
import { PriceOracleService } from './price-oracle.service';
import { BalanceSyncService } from './balance-sync.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SponsorController],
  providers: [
    EnokiSponsorService,
    SuiClientService,
    GasSponsorListener,
    EvmResolverService,
    SolanaResolverService,
    BalanceAggregatorService,
    PriceOracleService,
    BalanceSyncService,
  ],
  exports: [
    EnokiSponsorService,
    SuiClientService,
    EvmResolverService,
    SolanaResolverService,
    BalanceAggregatorService,
    PriceOracleService,
    BalanceSyncService,
  ],
})
export class BlockchainModule {}
