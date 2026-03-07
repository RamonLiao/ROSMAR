import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SuiClientService } from '../../../blockchain/sui.client';
import { Transaction } from '@mysten/sui/transactions';

export interface IssuePoapConfig {
  poapTypeId?: string;
}

@Injectable()
export class IssuePoapAction {
  private readonly logger = new Logger(IssuePoapAction.name);
  private readonly isDryRun: boolean;
  private readonly crmActionPackageId: string;

  constructor(
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'true') === 'true';
    this.crmActionPackageId = this.configService.get<string>(
      'CRM_ACTION_PACKAGE_ID',
      '0x0',
    );
  }

  async execute(profileId: string, config: IssuePoapConfig): Promise<void> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: { primaryAddress: true },
    });

    if (this.isDryRun) {
      this.logger.log(
        `[DRY-RUN] Issue POAP badge to ${profile.primaryAddress} (poapTypeId=${config.poapTypeId ?? 'default'})`,
      );
      return;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${this.crmActionPackageId}::badge::mint`,
      arguments: [
        tx.pure.address(profile.primaryAddress),
        tx.pure.string(config.poapTypeId ?? 'default'),
      ],
    });

    const result = await this.suiClient.executeTransaction(tx);
    this.logger.log(
      `POAP badge minted: ${result.digest} → ${profile.primaryAddress}`,
    );
  }
}
