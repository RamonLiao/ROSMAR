import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateDeletion(
    workspaceId: string,
    profileId: string,
    requestedBy: string,
    legalBasis: string,
  ) {
    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day grace
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: { gdprStatus: 'PENDING_DELETION', gdprScheduledAt: scheduledAt },
      });
      await tx.gdprDeletionLog.create({
        data: {
          workspaceId,
          profileId,
          requestedBy,
          legalBasis,
          dataCategories: ['profile', 'social', 'wallets', 'segments'],
          scheduledAt,
          status: 'PENDING',
        },
      });
    });
  }

  async cancelDeletion(profileId: string) {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
    });
    if (profile.gdprStatus !== 'PENDING_DELETION') {
      throw new BadRequestException('No pending deletion');
    }
    if (profile.gdprScheduledAt && profile.gdprScheduledAt <= new Date()) {
      throw new BadRequestException('Grace period expired');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: { gdprStatus: 'NONE', gdprScheduledAt: null },
      });
      await tx.gdprDeletionLog.updateMany({
        where: { profileId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });
  }

  async getStatus(profileId: string) {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
    });
    return { profileId, gdprStatus: profile.gdprStatus };
  }
}
