import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SuiClientService } from '../../../blockchain/sui.client';
import { Transaction } from '@mysten/sui/transactions';

export interface AirdropTokenConfig {
  coinType: string; // e.g., '0x2::sui::SUI' or custom token
  amount: string; // Amount in base units
}

@Injectable()
export class AirdropTokenAction {
  private readonly logger = new Logger(AirdropTokenAction.name);
  private isDryRun: boolean;

  constructor(
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'true') === 'true';
  }

  async execute(profileId: string, config: AirdropTokenConfig): Promise<void> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: { primaryAddress: true },
    });

    if (this.isDryRun) {
      this.logger.log(
        `[DRY-RUN] Airdrop ${config.amount} of ${config.coinType} to ${profile.primaryAddress}`,
      );
      return;
    }

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(config.amount)]);
    tx.transferObjects([coin], tx.pure.address(profile.primaryAddress));

    const result = await this.suiClient.executeTransaction(tx);
    this.logger.log(
      `Airdrop TX executed: ${result.digest} → ${profile.primaryAddress}`,
    );
  }
}
