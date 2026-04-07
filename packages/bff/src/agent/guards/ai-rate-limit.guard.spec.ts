import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

function makeContext(userId: string, workspaceId: string): ExecutionContext {
  const request = { user: { id: userId, workspaceId } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  } as any;
}

function makeRedis(incrFn?: (key: string) => number) {
  return {
    incr: jest.fn(async (key: string) => (incrFn ? incrFn(key) : 1)),
    expire: jest.fn(async () => true),
    ttl: jest.fn(async () => 42),
  };
}

function makeConfig() {
  return {
    get: jest.fn((key: string, def: number) => def),
  } as unknown as ConfigService;
}

describe('AiRateLimitGuard', () => {
  it('should allow request under limit', async () => {
    const redis = makeRedis();
    const guard = new AiRateLimitGuard(redis, makeConfig());
    const result = await guard.canActivate(makeContext('u1', 'ws1'));
    expect(result).toBe(true);
  });

  it('should reject when per-user limit exceeded', async () => {
    const redis = makeRedis((key) => (key.includes(':user:') ? 11 : 1));
    const guard = new AiRateLimitGuard(redis, makeConfig());
    await expect(guard.canActivate(makeContext('u1', 'ws1'))).rejects.toThrow(
      HttpException,
    );
    await expect(
      guard.canActivate(makeContext('u1', 'ws1')),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'AI rate limit exceeded (user)',
      }),
    });
  });

  it('should reject when per-workspace limit exceeded', async () => {
    const redis = makeRedis((key) => (key.includes(':ws:') ? 31 : 5));
    const guard = new AiRateLimitGuard(redis, makeConfig());
    await expect(guard.canActivate(makeContext('u1', 'ws1'))).rejects.toThrow(
      HttpException,
    );
    await expect(
      guard.canActivate(makeContext('u1', 'ws1')),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'AI rate limit exceeded (workspace)',
      }),
    });
  });

  it('should set expire only on first increment', async () => {
    const redis = makeRedis(() => 1);
    const guard = new AiRateLimitGuard(redis, makeConfig());
    await guard.canActivate(makeContext('u1', 'ws1'));
    expect(redis.expire).toHaveBeenCalledTimes(2);
  });

  it('should not set expire on subsequent increments', async () => {
    const redis = makeRedis(() => 5);
    const guard = new AiRateLimitGuard(redis, makeConfig());
    await guard.canActivate(makeContext('u1', 'ws1'));
    expect(redis.expire).not.toHaveBeenCalled();
  });
});
