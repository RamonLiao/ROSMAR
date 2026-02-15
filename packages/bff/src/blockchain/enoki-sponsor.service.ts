import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnokiClient } from '@mysten/enoki';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { toBase64 } from '@mysten/sui/utils';

export interface SponsoredTxResult {
  bytes: string;
  digest: string;
}

@Injectable()
export class EnokiSponsorService {
  private readonly logger = new Logger(EnokiSponsorService.name);
  private readonly enokiClient: EnokiClient | null;
  private readonly network: 'testnet' | 'mainnet';

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('ENOKI_SECRET_KEY', '');
    this.network = this.configService.get<string>('SUI_NETWORK', 'testnet') as
      | 'testnet'
      | 'mainnet';

    if (secretKey) {
      this.enokiClient = new EnokiClient({ apiKey: secretKey });
    } else {
      this.logger.warn('ENOKI_SECRET_KEY not set — sponsored TX disabled');
      this.enokiClient = null;
    }
  }

  get isEnabled(): boolean {
    return this.enokiClient !== null;
  }

  /**
   * Sponsor a transaction built by TxBuilderService.
   * Returns sponsored bytes + digest ready for client signing.
   */
  async sponsorTransaction(
    tx: Transaction,
    sender: string,
    suiClient: SuiJsonRpcClient,
    opts?: {
      allowedMoveCallTargets?: string[];
      allowedAddresses?: string[];
    },
  ): Promise<SponsoredTxResult> {
    if (!this.enokiClient) {
      throw new Error('Enoki sponsored transactions not configured');
    }

    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    const sponsored = await this.enokiClient.createSponsoredTransaction({
      network: this.network,
      transactionKindBytes: toBase64(txBytes),
      sender,
      allowedMoveCallTargets: opts?.allowedMoveCallTargets,
      allowedAddresses: opts?.allowedAddresses,
    });

    return {
      bytes: sponsored.bytes,
      digest: sponsored.digest,
    };
  }

  /**
   * Execute a sponsored transaction after collecting client signature.
   */
  async executeSponsoredTransaction(
    digest: string,
    signature: string,
  ): Promise<void> {
    if (!this.enokiClient) {
      throw new Error('Enoki sponsored transactions not configured');
    }

    await this.enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });
  }
}
