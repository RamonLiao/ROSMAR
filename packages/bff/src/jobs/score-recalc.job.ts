import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScoreRecalcJob {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateScores() {
    console.log('Running score recalculation job...');
    // TODO: Implement score recalculation logic
  }
}
