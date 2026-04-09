import { Injectable, Logger } from '@nestjs/common';

export const SUI_TOKEN_COINGECKO_MAP: Record<string, string> = {
  '0x2::sui::SUI': 'sui',
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC':
    'usd-coin',
  '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN':
    'tether',
  '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN':
    'weth',
  '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS':
    'cetus-protocol',
  '0x7016aae72cfc67f2fadf55769c0a7dd54291a583b63051a5ed71081cce836ac6::sca::SCA':
    'scallop-2',
  '0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX':
    'navi-protocol',
  '0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc::afsui::AFSUI':
    'aftermath-staked-sui',
};

export const KNOWN_DECIMALS: Record<string, number> = {
  '0x2::sui::SUI': 9,
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC': 6,
  '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': 6,
  '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN': 8,
};

@Injectable()
export class PriceOracleService {
  private suiCache: { price: number; fetchedAt: number } | null = null;
  private solCache: { price: number; fetchedAt: number } | null = null;
  private tokenPriceCache: {
    prices: Record<string, number>;
    fetchedAt: number;
  } | null = null;
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

  async getTokenPrice(coinType: string): Promise<number | null> {
    const coingeckoId = SUI_TOKEN_COINGECKO_MAP[coinType];
    if (!coingeckoId) return null;

    const prices = await this.fetchTokenPrices();
    return prices[coingeckoId] ?? null;
  }

  private async fetchTokenPrices(): Promise<Record<string, number>> {
    if (
      this.tokenPriceCache &&
      Date.now() - this.tokenPriceCache.fetchedAt < this.CACHE_TTL
    ) {
      return this.tokenPriceCache.prices;
    }

    const ids = [...new Set(Object.values(SUI_TOKEN_COINGECKO_MAP))].join(',');
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      );
      const data = (await res.json()) as Record<
        string,
        { usd?: number } | undefined
      >;
      const prices: Record<string, number> = {};
      for (const [id, info] of Object.entries(data)) {
        if (info?.usd != null) prices[id] = info.usd;
      }
      this.tokenPriceCache = { prices, fetchedAt: Date.now() };
      return prices;
    } catch (err) {
      this.logger.warn(`Token price batch fetch failed: ${err}`);
      return this.tokenPriceCache?.prices ?? {};
    }
  }
}
