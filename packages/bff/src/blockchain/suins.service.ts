import { Injectable, Logger } from '@nestjs/common';
import { SuiClientService } from './sui.client';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SuinsService {
  private readonly logger = new Logger(SuinsService.name);
  private readonly cache = new Map<string, CacheEntry<string | null>>();

  constructor(private suiClient: SuiClientService) {}

  private cacheGet(key: string): string | null | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private cacheSet(key: string, value: string | null): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  /**
   * Resolve .sui name to address
   */
  async resolveNameToAddress(name: string): Promise<string | null> {
    if (!name || !name.trim()) return null;

    const cacheKey = `suins:fwd:${name}`;
    const cached = this.cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const client = this.suiClient.getClient();
      const address = await client.resolveNameServiceAddress({ name });
      this.cacheSet(cacheKey, address);
      return address;
    } catch (error) {
      this.logger.warn(`Failed to resolve SuiNS name "${name}": ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Reverse resolve address to .sui name
   */
  async resolveAddressToName(address: string): Promise<string | null> {
    if (!address || !address.trim()) return null;

    const cacheKey = `suins:rev:${address}`;
    const cached = this.cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const client = this.suiClient.getClient();
      const result = await client.resolveNameServiceNames({ address });
      const name = result.data[0] ?? null;
      this.cacheSet(cacheKey, name);
      return name;
    } catch (error) {
      this.logger.warn(
        `Failed to reverse resolve address "${address}": ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Check if a .sui name is available
   */
  async isNameAvailable(name: string): Promise<boolean> {
    const address = await this.resolveNameToAddress(name);
    return address === null;
  }

  /**
   * Normalize .sui name (lowercase, remove .sui suffix if present)
   */
  normalizeName(name: string): string {
    return name.toLowerCase().replace(/\.sui$/, '');
  }
}
