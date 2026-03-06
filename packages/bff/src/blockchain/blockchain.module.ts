import { Module } from '@nestjs/common';
import { SponsorController } from './sponsor.controller';
import { EnokiSponsorService } from './enoki-sponsor.service';
import { SuiClientService } from './sui.client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SponsorController],
  providers: [EnokiSponsorService, SuiClientService],
  exports: [EnokiSponsorService, SuiClientService],
})
export class BlockchainModule {}
