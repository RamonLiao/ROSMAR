import { Module } from '@nestjs/common';
import { AutoTagService } from './auto-tag.service';
import { AutoTagListener } from './auto-tag.listener';

@Module({
  providers: [AutoTagService, AutoTagListener],
  exports: [AutoTagService],
})
export class AutoTagModule {}
