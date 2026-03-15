import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('analytics')
export class VitalsController {
  private readonly logger = new Logger(VitalsController.name);

  @Post('vitals')
  reportVitals(
    @Body() body: { name: string; value: number; rating: string; pathname: string; timestamp: number },
  ) {
    this.logger.log({
      msg: 'web-vital',
      metric: body.name,
      value: body.value,
      rating: body.rating,
      pathname: body.pathname,
      timestamp: body.timestamp,
    });
    return { ok: true };
  }
}
