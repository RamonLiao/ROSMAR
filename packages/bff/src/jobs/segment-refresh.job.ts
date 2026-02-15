import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SegmentRefreshJob {
  constructor(private readonly prisma: PrismaService) {}

  async refreshSegments() {
    console.log('Running segment refresh job...');
    // TODO: Implement segment refresh logic
  }
}
