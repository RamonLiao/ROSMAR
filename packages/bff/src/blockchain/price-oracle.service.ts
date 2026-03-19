import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PriceOracleService {
  private suiCache: { price: number; fetchedAt: number } | null = null;
  private solCache: { price: number; fetchedAt: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly logger = new Logger(PriceOracleService.name);

  async getSuiUsdPrice(): Promise<number> {
    if (
      this.suiCache &&
      Date.now() - this.suiCache.fetchedAt < this.CACHE_TTL
    ) {
      return this.suiCache.price;
    }
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd',
      );
      const data = (await res.json()) as { sui?: { usd?: number } };
      const price = data?.sui?.usd ?? 0;
      this.suiCache = { price, fetchedAt: Date.now() };
      return price;
    } catch (err) {
      this.logger.warn(`SUI price fetch failed: ${err}`);
      return this.suiCache?.price ?? 0; // stale cache fallback
    }
  }

  async getSolUsdPrice(): Promise<number> {
    if (
      this.solCache &&
      Date.now() - this.solCache.fetchedAt < this.CACHE_TTL
    ) {
      return this.solCache.price;
    }
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      );
      const data = (await res.json()) as { solana?: { usd?: number } };
      const price = data?.solana?.usd ?? 0;
      this.solCache = { price, fetchedAt: Date.now() };
      return price;
    } catch (err) {
      this.logger.warn(`SOL price fetch failed: ${err}`);
      return this.solCache?.price ?? 0; // stale cache fallback
    }
  }
}
