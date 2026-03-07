import { Module } from '@nestjs/common';
import { AutoTagService } from './auto-tag.service';

@Module({
  providers: [AutoTagService],
  exports: [AutoTagService],
})
export class AutoTagModule {}
