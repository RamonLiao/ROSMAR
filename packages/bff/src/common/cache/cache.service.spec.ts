import { Test } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { Cacheable } from './cacheable.decorator';

// In-memory Map mock for Redis
function createRedisMock() {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  return {
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: jest.fn(
      async (key: string, value: string, _ex?: string, ttl?: number) => {
        store.set(key, {
          value,
          expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
        });
      },
    ),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

describe('CacheService', () => {
  let service: CacheService;
  let redisMock: ReturnType<typeof createRedisMock>;

  beforeEach(async () => {
    redisMock = createRedisMock();
    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  it('get/set — set key with TTL, get returns value', async () => {
    await service.set('user:1', { name: 'Alice' }, 60);
    const result = await service.get('user:1');
    expect(result).toEqual({ name: 'Alice' });
    expect(redisMock.set).toHaveBeenCalledWith(
      'user:1',
      JSON.stringify({ name: 'Alice' }),
      'EX',
      60,
    );
  });

  it('get expired — returns null for missing key', async () => {
    const result = await service.get('nonexistent');
    expect(result).toBeNull();
  });

  it('evict — removes key, subsequent get returns null', async () => {
    await service.set('user:2', { name: 'Bob' }, 300);
    await service.evict('user:2');
    const result = await service.get('user:2');
    expect(result).toBeNull();
    expect(redisMock.del).toHaveBeenCalledWith('user:2');
  });
});

describe('@Cacheable decorator', () => {
  let cacheService: CacheService;
  let redisMock: ReturnType<typeof createRedisMock>;

  beforeEach(async () => {
    redisMock = createRedisMock();
    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    cacheService = module.get(CacheService);
  });

  it('first call hits underlying fn, second call returns cached', async () => {
    const spy = jest.fn().mockResolvedValue({ score: 42 });

    class TestService {
      cacheService: CacheService;
      constructor(cs: CacheService) {
        this.cacheService = cs;
      }

      @Cacheable('test', 60)
      async getScore(id: string) {
        return spy(id);
      }
    }

    const svc = new TestService(cacheService);

    const r1 = await svc.getScore('abc');
    expect(r1).toEqual({ score: 42 });
    expect(spy).toHaveBeenCalledTimes(1);

    const r2 = await svc.getScore('abc');
    expect(r2).toEqual({ score: 42 });
    expect(spy).toHaveBeenCalledTimes(1); // still 1 — cached
  });

  it('after evict, next call hits fn again', async () => {
    const spy = jest.fn().mockResolvedValue({ v: 1 });

    class TestService {
      cacheService: CacheService;
      constructor(cs: CacheService) {
        this.cacheService = cs;
      }

      @Cacheable('evict-test', 60)
      async getData(id: string) {
        return spy(id);
      }
    }

    const svc = new TestService(cacheService);

    await svc.getData('x');
    expect(spy).toHaveBeenCalledTimes(1);

    // Evict using the same key pattern as the decorator
    await cacheService.evict('evict-test:["x"]');

    spy.mockResolvedValue({ v: 2 });
    const r2 = await svc.getData('x');
    expect(r2).toEqual({ v: 2 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
