import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { resolve, performReverseLookup } from '@bonfida/spl-name-service';

@Injectable()
export class SolanaResolverService {
  private readonly logger = new Logger(SolanaResolverService.name);
  private connection: Connection;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'SOLANA_RPC_URL',
      'https://api.mainnet-beta.solana.com',
    );
    this.connection = new Connection(rpcUrl);
  }

  /** Resolve .sol name (e.g. "bonfida.sol") → Solana address, or null */
  async resolveSns(name: string): Promise<string | null> {
    try {
      const domain = name.replace(/\.sol$/, '');
      const owner = await resolve(this.connection, domain);
      return owner.toBase58();
    } catch (err) {
      this.logger.warn(`Failed to resolve SNS name "${name}": ${err}`);
      return null;
    }
  }

  /** Reverse-lookup Solana address → .sol name, or null */
  async lookupAddress(address: string): Promise<string | null> {
    try {
      const pubkey = new PublicKey(address);
      const domainName = await performReverseLookup(this.connection, pubkey);
      return `${domainName}.sol`;
    } catch (err) {
      this.logger.warn(`Failed to reverse-lookup address "${address}": ${err}`);
      return null;
    }
  }
}
