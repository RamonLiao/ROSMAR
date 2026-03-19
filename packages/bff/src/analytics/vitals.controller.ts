import { Controller, Post, Body, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNumber, IsIn } from 'class-validator';

const WEB_VITAL_NAMES = ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'] as const;

class ReportVitalsDto {
  @IsIn(WEB_VITAL_NAMES)
  name: string;

  @IsNumber()
  value: number;

  @IsIn(['good', 'needs-improvement', 'poor'])
  rating: string;

  @IsString()
  pathname: string;

  @IsNumber()
  timestamp: number;
}

@Controller('analytics')
export class VitalsController {
  private readonly logger = new Logger(VitalsController.name);

  @Post('vitals')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  reportVitals(@Body() body: ReportVitalsDto) {
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
