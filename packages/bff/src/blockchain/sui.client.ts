import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

@Injectable()
export class SuiClientService {
  private client: SuiJsonRpcClient;
  private keypair: Ed25519Keypair;
  private isDryRun: boolean;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'SUI_RPC_URL',
      'https://fullnode.testnet.sui.io:443',
    );
    const network = this.configService.get<string>('SUI_NETWORK', 'testnet');

    this.client = new SuiJsonRpcClient({ url: rpcUrl, network });

    // Load deployer keypair from environment
    const privateKey = this.configService.get<string>('SUI_PRIVATE_KEY');
    if (privateKey) {
      this.keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(privateKey, 'base64'),
      );
    }

    this.isDryRun = this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  getClient(): SuiJsonRpcClient {
    return this.client;
  }

  getAddress(): string {
    return this.keypair?.getPublicKey().toSuiAddress() || '';
  }

  async executeTransaction(tx: Transaction) {
    if (this.isDryRun) {
      return {
        digest: 'dry-run',
        events: [],
        effects: { status: { status: 'success' } },
        objectChanges: [],
      };
    }

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    return result;
  }

  async getObject(objectId: string) {
    return this.client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });
  }

  async multiGetObjects(objectIds: string[]) {
    return this.client.multiGetObjects({
      ids: objectIds,
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });
  }

  async getOwnedObjects(
    address: string,
    options?: {
      showContent?: boolean;
      showDisplay?: boolean;
      showType?: boolean;
      limit?: number;
      cursor?: string;
    },
  ) {
    return this.client.getOwnedObjects({
      owner: address,
      options: {
        showContent: options?.showContent ?? true,
        showDisplay: options?.showDisplay ?? false,
        showType: options?.showType ?? true,
      },
      limit: options?.limit ?? 50,
      cursor: options?.cursor,
    });
  }

  async queryEvents(query: any) {
    return this.client.queryEvents(query);
  }
}
