import { ThrottlerModule } from '@nestjs/throttler';

export const ThrottleConfig = ThrottlerModule.forRoot([
  { name: 'global', ttl: 60000, limit: 100 },
  { name: 'auth', ttl: 60000, limit: 10 },
  { name: 'ai', ttl: 60000, limit: 20 },
  { name: 'gdpr', ttl: 600000, limit: 3 },
]);
