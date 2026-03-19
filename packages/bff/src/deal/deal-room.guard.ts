import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gates access to deal documents and escrow endpoints.
 * Allows:
 *  - Workspace admins (roleLevel >= 3)
 *  - Deal profile owner (buyer wallet addresses)
 *  - Escrow payer / payee
 *  - Escrow arbitrators
 */
@Injectable()
export class DealRoomGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const { address: userAddress, workspaceId } = user;

    // Workspace admins (roleLevel >= 3) always pass
    if (user.role >= 3) {
      return true;
    }

    const dealId = request.params.dealId ?? request.params.id;
    if (!dealId) {
      throw new ForbiddenException('Missing deal ID');
    }

    const participants = await this.gatherParticipants(dealId, workspaceId);

    if (participants.has(userAddress)) {
      return true;
    }

    throw new ForbiddenException(
      'You are not a participant in this deal room',
    );
  }

  /**
   * Collect all participant addresses for a deal:
   *  - profile.wallets[].address (buyer)
   *  - escrows[].payer
   *  - escrows[].payee
   *  - escrows[].arbitrators[].address
   */
  async gatherParticipants(
    dealId: string,
    workspaceId: string,
  ): Promise<Set<string>> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, workspaceId },
      include: {
        profile: {
          include: { wallets: { select: { address: true } } },
        },
        escrows: {
          include: { arbitrators: { select: { address: true } } },
        },
      },
    });

    if (!deal) {
      throw new ForbiddenException('Deal not found');
    }

    const addresses = new Set<string>();

    // Profile owner wallets (buyer)
    for (const w of deal.profile.wallets) {
      addresses.add(w.address);
    }

    // Escrow participants
    for (const escrow of deal.escrows) {
      addresses.add(escrow.payer);
      addresses.add(escrow.payee);
      for (const arb of escrow.arbitrators) {
        addresses.add(arb.address);
      }
    }

    return addresses;
  }
}
