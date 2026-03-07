import { CacheService } from './cache.service';

export function Cacheable(keyPrefix: string, ttlSeconds: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = (this as any).cacheService;
      if (!cacheService) return originalMethod.apply(this, args);
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      const cached = await cacheService.get(key);
      if (cached !== null) return cached;
      const result = await originalMethod.apply(this, args);
      await cacheService.set(key, result, ttlSeconds);
      return result;
    };
  };
}
