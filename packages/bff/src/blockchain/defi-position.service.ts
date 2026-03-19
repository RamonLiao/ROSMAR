import { Injectable } from '@nestjs/common';
import { SuiClientService } from './sui.client';

export interface StakePosition {
  validatorAddress: string;
  stakeAmount: string; // in MIST
  estimatedReward: string;
  stakeActivationEpoch: string;
  status: 'active' | 'pending' | 'unstaked';
}

export interface LpPosition {
  protocol: string;
  poolId: string;
  tokenA: string;
  tokenB: string;
  liquidity: string;
  objectId: string;
}

export interface DefiSummary {
  totalStakedSui: string;
  stakes: StakePosition[];
  lpPositions: LpPosition[];
}

@Injectable()
export class DefiPositionService {
  constructor(private readonly suiClient: SuiClientService) {}

  async getPositions(address: string): Promise<DefiSummary> {
    const [stakes, lpPositions] = await Promise.all([
      this.fetchStakes(address),
      this.fetchLpPositions(address),
    ]);

    const totalStakedSui = stakes
      .reduce((sum, s) => sum + BigInt(s.stakeAmount), 0n)
      .toString();

    return { totalStakedSui, stakes, lpPositions };
  }

  private async fetchStakes(address: string): Promise<StakePosition[]> {
    try {
      const client = this.suiClient.getClient();
      const stakes = await client.getStakes({ owner: address });

      const positions: StakePosition[] = [];
      for (const delegation of stakes) {
        for (const stake of delegation.stakes) {
          positions.push({
            validatorAddress: delegation.validatorAddress,
            stakeAmount: stake.principal,
            estimatedReward:
              stake.status === 'Active'
                ? stake.estimatedReward ?? '0'
                : '0',
            stakeActivationEpoch: stake.stakeActiveEpoch,
            status: stake.status === 'Active' ? 'active' : 'pending',
          });
        }
      }
      return positions;
    } catch {
      return [];
    }
  }

  private async fetchLpPositions(address: string): Promise<LpPosition[]> {
    try {
      const client = this.suiClient.getClient();
      const { data: objects } = await client.getOwnedObjects({
        owner: address,
        options: { showContent: true, showType: true },
        limit: 100,
      });

      const positions: LpPosition[] = [];
      for (const obj of objects) {
        if (!obj.data?.type) continue;
        const type = obj.data.type;

        // Detect Cetus CLMM positions
        if (type.includes('::position::Position')) {
          const fields = (obj.data.content as any)?.fields ?? {};
          positions.push({
            protocol: 'Cetus',
            poolId: fields.pool ?? '',
            tokenA: this.extractTokenFromType(type, 0),
            tokenB: this.extractTokenFromType(type, 1),
            liquidity: fields.liquidity ?? '0',
            objectId: obj.data.objectId,
          });
        }

        // Detect Aftermath LP tokens
        if (
          type.includes('::lp_coin::LpCoin') ||
          type.includes('::pool::LP')
        ) {
          const fields = (obj.data.content as any)?.fields ?? {};
          positions.push({
            protocol: 'Aftermath',
            poolId: fields.pool_id ?? '',
            tokenA: '',
            tokenB: '',
            liquidity: fields.balance ?? fields.value ?? '0',
            objectId: obj.data.objectId,
          });
        }
      }

      return positions;
    } catch {
      return [];
    }
  }

  /**
   * Extract type parameters from generic type.
   * e.g., Position<0x2::sui::SUI, 0xusdc::usdc::USDC> -> "SUI" (index 0), "USDC" (index 1)
   */
  private extractTokenFromType(type: string, index: number): string {
    const match = type.match(/<(.+)>/);
    if (!match) return '';
    const params = match[1].split(',').map((s) => s.trim());
    const param = params[index] ?? '';
    const parts = param.split('::');
    return parts[parts.length - 1] ?? param;
  }
}
