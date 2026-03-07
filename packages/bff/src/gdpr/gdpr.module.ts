import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { GdprExecutorService } from './gdpr-executor.service';
import { GdprExportService } from './gdpr-export.service';
import { GdprCleanupJob } from './gdpr-cleanup.job';

@Module({
  imports: [AuthModule],
  controllers: [GdprController],
  providers: [GdprService, GdprExecutorService, GdprExportService, GdprCleanupJob],
  exports: [GdprService],
})
export class GdprModule {}
