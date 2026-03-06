import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IndexerEventDto } from './indexer-event.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handleIndexerEvent(dto: IndexerEventDto): Promise<void> {
    this.logger.log(
      `Received indexer event: ${dto.event_type} (tx: ${dto.tx_digest})`,
    );

    // Emit typed event for downstream listeners
    this.eventEmitter.emit('indexer.event', dto);

    // Emit event-type-specific event for granular listeners
    this.eventEmitter.emit(`indexer.event.${dto.event_type}`, dto);
  }
}
