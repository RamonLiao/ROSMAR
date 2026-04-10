import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../common/cache/cache.service';
import { IndexerEventDto } from './indexer-event.dto';

const IDEMPOTENCY_TTL_SECS = 24 * 60 * 60; // 24 hours

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cache: CacheService,
  ) {}

  async handleIndexerEvent(dto: IndexerEventDto): Promise<{ deduplicated: boolean }> {
    // Idempotency check — skip if this event_id was already processed
    const idempotencyKey = `webhook:idem:${dto.event_id}`;
    const existing = await this.cache.get(idempotencyKey);
    if (existing) {
      this.logger.debug(`Duplicate event_id ${dto.event_id}, skipping`);
      return { deduplicated: true };
    }

    // Mark as processed before emitting (at-most-once semantics)
    await this.cache.set(idempotencyKey, { processedAt: Date.now() }, IDEMPOTENCY_TTL_SECS);

    this.logger.log(
      `Received indexer event: ${dto.event_type} (tx: ${dto.tx_digest})`,
    );

    // Emit typed event for downstream listeners
    this.eventEmitter.emit('indexer.event', dto);

    // Emit event-type-specific event for granular listeners
    this.eventEmitter.emit(`indexer.event.${dto.event_type}`, dto);

    return { deduplicated: false };
  }
}
