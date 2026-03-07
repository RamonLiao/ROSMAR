import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') @Optional() private redis?: any,
  ) {}

  async check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.0.0',
    };
  }

  async checkDetailed() {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // DB
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.db = { status: 'up', latencyMs: Date.now() - dbStart };
    } catch {
      checks.db = { status: 'down', latencyMs: Date.now() - dbStart };
    }

    // Redis
    if (this.redis) {
      const redisStart = Date.now();
      try {
        await this.redis.ping();
        checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
      } catch {
        checks.redis = { status: 'down', latencyMs: Date.now() - redisStart };
      }
    }

    return {
      status: Object.values(checks).every((c) => c.status === 'up')
        ? 'ok'
        : 'degraded',
      checks,
    };
  }
}
