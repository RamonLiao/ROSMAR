import { Injectable, Logger } from '@nestjs/common';
import { StepVerifier } from './step-verifier.interface';
import { SuiClientService } from '../../blockchain/sui.client';

interface VerificationConfig {
  recipient?: string;
  coinType?: string;
  minAmount?: string;
  originalPackageId?: string;
  eventName?: string;
  target?: string;
  structType?: string;
}

@Injectable()
export class RpcVerifier implements StepVerifier {
  private readonly logger = new Logger(RpcVerifier.name);

  constructor(private readonly suiClient: SuiClientService) {}

  async verify(
    profileId: string,
    step: { actionType: string; actionConfig: Record<string, unknown> },
    claimData: Record<string, unknown>,
  ): Promise<{ verified: boolean; txDigest?: string }> {
    const txDigest = claimData?.txDigest as string;
    const verificationType =
      (step.actionConfig?.verificationType as string) ?? 'any_tx';
    const config = (step.actionConfig?.verificationConfig ??
      {}) as VerificationConfig;

    if (verificationType === 'object_ownership') {
      return this.verifyObjectOwnership(profileId, config);
    }

    if (!txDigest) {
      return { verified: false };
    }

    try {
      const tx = await this.suiClient.getClient().getTransactionBlock({
        digest: txDigest,
        options: {
          showBalanceChanges: true,
          showEvents: true,
          showInput: true,
          showEffects: true,
        },
      });

      const status = (tx.effects as any)?.status?.status;
      if (status !== 'success') {
        this.logger.debug(`Tx ${txDigest} failed with status: ${status}`);
        return { verified: false, txDigest };
      }

      switch (verificationType) {
        case 'token_transfer':
          return { verified: this.verifyTokenTransfer(tx, config), txDigest };
        case 'nft_mint':
          return { verified: this.verifyEvent(tx, config), txDigest };
        case 'contract_call':
          return { verified: this.verifyContractCall(tx, config), txDigest };
        case 'staking':
          return {
            verified: this.verifyEvent(tx, {
              originalPackageId: '0x3',
              eventName: 'StakingRequestEvent',
              ...config,
            }),
            txDigest,
          };
        case 'defi_interaction':
          return { verified: this.verifyEvent(tx, config), txDigest };
        case 'any_tx':
        default:
          return { verified: true, txDigest };
      }
    } catch (err) {
      this.logger.warn(`Failed to verify tx ${txDigest}: ${err}`);
      return { verified: false, txDigest };
    }
  }

  private verifyTokenTransfer(tx: any, config: VerificationConfig): boolean {
    if (!config.recipient) return false;
    const changes = tx.balanceChanges ?? [];
    return changes.some((bc: any) => {
      const owner = bc.owner?.AddressOwner ?? bc.owner?.ObjectOwner;
      const matchRecipient = owner === config.recipient;
      const matchCoin = !config.coinType || bc.coinType === config.coinType;
      const matchAmount =
        !config.minAmount || BigInt(bc.amount) >= BigInt(config.minAmount);
      return matchRecipient && matchCoin && matchAmount;
    });
  }

  private verifyEvent(tx: any, config: VerificationConfig): boolean {
    if (!config.originalPackageId) return false;
    const events = tx.events ?? [];
    return events.some((e: any) => {
      const typePrefix = config.originalPackageId + '::';
      const matchPackage = e.type.startsWith(typePrefix);
      const matchEvent =
        !config.eventName || e.type.includes(config.eventName);
      return matchPackage && matchEvent;
    });
  }

  private verifyContractCall(tx: any, config: VerificationConfig): boolean {
    if (!config.target) return false;
    const txData = tx.transaction?.data?.transaction;
    if (!txData) return false;
    const commands = txData.commands ?? txData.transactions ?? [];
    return commands.some((cmd: any) => {
      if (cmd.MoveCall) {
        const callTarget = `${cmd.MoveCall.package}::${cmd.MoveCall.module}::${cmd.MoveCall.function}`;
        return callTarget === config.target;
      }
      return false;
    });
  }

  private async verifyObjectOwnership(
    profileId: string,
    config: VerificationConfig,
  ): Promise<{ verified: boolean }> {
    if (!config.structType) return { verified: false };
    try {
      const result = await this.suiClient.getClient().getOwnedObjects({
        owner: profileId,
        filter: { StructType: config.structType },
        limit: 1,
      });
      return { verified: (result.data?.length ?? 0) > 0 };
    } catch (err) {
      this.logger.warn(`Object ownership check failed: ${err}`);
      return { verified: false };
    }
  }
}
