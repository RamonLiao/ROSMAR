import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface UpdateTierConfig {
  tier: number;
}

@Injectable()
export class UpdateTierAction {
  private readonly logger = new Logger(UpdateTierAction.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string, config: UpdateTierConfig): Promise<void> {
    if (config.tier == null) {
      throw new Error('tier is required for update_tier action');
    }

    // Clamp tier to valid range 0-5 (Profile.tier is Int in Prisma)
    const tier = Math.max(0, Math.min(5, Math.floor(config.tier)));

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { tier },
    });

    this.logger.log(`Profile ${profileId} tier updated to ${tier}`);
  }
}
