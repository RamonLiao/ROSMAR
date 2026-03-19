import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';

@Injectable()
export class EvmResolverService {
  private readonly logger = new Logger(EvmResolverService.name);
  private provider: JsonRpcProvider;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'EVM_RPC_URL',
      'https://eth.llamarpc.com',
    );
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /** Resolve ENS name (e.g. "vitalik.eth") → address, or null */
  async resolveEns(name: string): Promise<string | null> {
    try {
      return await this.provider.resolveName(name);
    } catch (err) {
      this.logger.warn(`Failed to resolve ENS name "${name}": ${err}`);
      return null;
    }
  }

  /** Resolve ENS avatar (EIP-155 compliant) for a given ENS name, or null */
  async resolveAvatar(ensName: string): Promise<string | null> {
    try {
      return await this.provider.getAvatar(ensName);
    } catch (err) {
      this.logger.warn(`Failed to resolve ENS avatar for "${ensName}": ${err}`);
      return null;
    }
  }

  /** Reverse-resolve address → ENS name, or null */
  async lookupAddress(address: string): Promise<string | null> {
    try {
      return await this.provider.lookupAddress(address);
    } catch (err) {
      this.logger.warn(`Failed to lookup address "${address}": ${err}`);
      return null;
    }
  }
}
