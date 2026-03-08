import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { IndexerEventDto } from './indexer-event.dto';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('indexer-event')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
  async handleIndexerEvent(@Body() dto: IndexerEventDto) {
    this.logger.debug(`POST /webhooks/indexer-event: ${dto.event_type}`);
    await this.webhookService.handleIndexerEvent(dto);
    return { status: 'ok' };
  }
}
