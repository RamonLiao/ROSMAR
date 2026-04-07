import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly userLimit: number;
  private readonly workspaceLimit: number;
  private readonly windowSec: number;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: any,
    private readonly configService: ConfigService,
  ) {
    this.userLimit = this.configService.get<number>('AI_RATE_LIMIT_USER', 10);
    this.workspaceLimit = this.configService.get<number>(
      'AI_RATE_LIMIT_WORKSPACE',
      30,
    );
    this.windowSec = this.configService.get<number>(
      'AI_RATE_LIMIT_WINDOW_SEC',
      60,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const { id: userId, workspaceId } = req.user;

    const userKey = `ai-ratelimit:user:${userId}`;
    const wsKey = `ai-ratelimit:ws:${workspaceId}`;

    const [userCount, wsCount] = await Promise.all([
      this.increment(userKey),
      this.increment(wsKey),
    ]);

    res.setHeader('X-RateLimit-User-Limit', this.userLimit);
    res.setHeader(
      'X-RateLimit-User-Remaining',
      Math.max(0, this.userLimit - userCount),
    );
    res.setHeader('X-RateLimit-Workspace-Limit', this.workspaceLimit);
    res.setHeader(
      'X-RateLimit-Workspace-Remaining',
      Math.max(0, this.workspaceLimit - wsCount),
    );

    if (userCount > this.userLimit) {
      const ttl = await this.redis.ttl(userKey);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'AI rate limit exceeded (user)',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (wsCount > this.workspaceLimit) {
      const ttl = await this.redis.ttl(wsKey);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'AI rate limit exceeded (workspace)',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async increment(key: string): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.windowSec);
    }
    return count;
  }
}
