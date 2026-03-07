import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GdprExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(profileId: string) {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
    });
    if (profile.gdprStatus === 'COMPLETED') {
      throw new BadRequestException('PII already deleted');
    }
    const [socialLinks, wallets, deals, questCompletions] = await Promise.all([
      this.prisma.socialLink.findMany({ where: { profileId } }),
      this.prisma.profileWallet.findMany({ where: { profileId } }),
      this.prisma.deal.findMany({ where: { profileId } }),
      this.prisma.questCompletion.findMany({ where: { profileId } }),
    ]);
    return {
      profile,
      socialLinks,
      wallets,
      deals,
      questCompletions,
      exportedAt: new Date().toISOString(),
    };
  }
}
