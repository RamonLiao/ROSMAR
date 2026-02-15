// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { SuiClientService } from '../../../blockchain/sui.client';
import { Transaction } from '@mysten/sui/transactions';
import { ConfigService } from '@nestjs/config';

export interface AirdropTokenConfig {
  coinType: string; // e.g., '0x2::sui::SUI' or custom token
  amount: string; // Amount in base units
}

@Injectable()
export class AirdropTokenAction {
  constructor(
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
  ) {}

  async execute(profileId: string, config: AirdropTokenConfig): Promise<void> {
    // TODO: Build and execute token transfer transaction
    console.log(`Airdropping ${config.amount} of ${config.coinType} to profile ${profileId}`);

    // In production:
    // const tx = new Transaction();
    //
    // // Split coin from treasury
    // const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(config.amount)]);
    //
    // // Transfer to profile address
    // tx.transferObjects([coin], tx.pure.address(profileId));
    //
    // await this.suiClient.executeTransaction(tx);
  }
}
