import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PriceOracleService {
  private cache: { price: number; fetchedAt: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly logger = new Logger(PriceOracleService.name);

  async getSuiUsdPrice(): Promise<number> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.CACHE_TTL) {
      return this.cache.price;
    }
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd',
      );
      const data = (await res.json()) as { sui?: { usd?: number } };
      const price = data?.sui?.usd ?? 0;
      this.cache = { price, fetchedAt: Date.now() };
      return price;
    } catch (err) {
      this.logger.warn(`Price fetch failed: ${err}`);
      return this.cache?.price ?? 0; // stale cache fallback
    }
  }
}
