import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuthModule } from '../auth/auth.module';
import { EngagementModule } from '../engagement/engagement.module';
import { VitalsController } from './vitals.controller';

@Module({
  imports: [AuthModule, EngagementModule],
  controllers: [AnalyticsController, VitalsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
