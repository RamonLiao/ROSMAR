import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'segment-eval' },
      { name: 'segment-refresh' },
      { name: 'segment-diff' },
      { name: 'campaign-scheduler' },
      { name: 'sla-checker' },
      { name: 'sync-onchain' },
      { name: 'vault-expiry' },
      { name: 'score-recalc' },
      { name: 'broadcast-send' },
      { name: 'workflow-delay' },
      { name: 'time-elapsed-trigger' },
      { name: 'balance-sync' },
      { name: 'discord-role-sync' },
      { name: 'campaign-recurring' },
      { name: 'vault-release' },
    ),
  ],
  exports: [BullModule],
})
export class BullQueueModule {}
