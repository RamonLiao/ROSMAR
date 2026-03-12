import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AddToSegmentConfig {
  segmentId: string;
}

@Injectable()
export class AddToSegmentAction {
  private readonly logger = new Logger(AddToSegmentAction.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string, config: AddToSegmentConfig): Promise<void> {
    if (!config.segmentId) {
      throw new Error('segmentId is required for add_to_segment action');
    }

    await this.prisma.segmentMembership.upsert({
      where: {
        segmentId_profileId: {
          segmentId: config.segmentId,
          profileId,
        },
      },
      create: {
        segmentId: config.segmentId,
        profileId,
      },
      update: {}, // already a member — no-op
    });

    this.logger.log(`Profile ${profileId} added to segment ${config.segmentId}`);
  }
}
