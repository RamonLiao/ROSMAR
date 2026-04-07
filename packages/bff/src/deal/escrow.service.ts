import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { SuiClientService } from '../blockchain/sui.client';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { AddVestingDto } from './dto/escrow-action.dto';

const FUNDABLE_STATES = ['CREATED'];
const RELEASABLE_STATES = ['FUNDED', 'PARTIALLY_RELEASED'];
const REFUNDABLE_STATES = ['CREATED', 'FUNDED'];
const DISPUTABLE_STATES = ['FUNDED', 'PARTIALLY_RELEASED'];

@Injectable()
export class EscrowService {
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txBuilder: TxBuilderService,
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  async createEscrow(
    workspaceId: string,
    dealId: string,
    dto: CreateEscrowDto,
  ) {
    if (dto.arbiterThreshold > dto.arbitrators.length) {
      throw new BadRequestException('Threshold exceeds arbitrator count');
    }

    return this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.create({
        data: {
          workspaceId,
          dealId,
          payer: 'caller',
          payee: dto.payee,
          totalAmount: dto.totalAmount,
          tokenType: dto.tokenType || 'SUI',
          arbiterThreshold: dto.arbiterThreshold,
          expiryAt: dto.expiryAt ? new Date(dto.expiryAt) : null,
        },
      });

      for (const addr of dto.arbitrators) {
        await tx.escrowArbitrator.create({
          data: { escrowId: escrow.id, address: addr },
        });
      }

      return escrow;
    });
  }

  /** Execute a chain TX unless dry-run mode is active */
  private async execChainTx(buildTx: () => any): Promise<any> {
    if (this.isDryRun) {
      return { digest: 'dry-run', events: [] };
    }
    const tx = buildTx();
    return this.suiClient.executeTransaction(tx);
  }

  async fundEscrow(escrowId: string, coinObjectId: string) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, FUNDABLE_STATES);

    let txDigest = 'dry-run';

    if (!this.isDryRun) {
      if (!(escrow as any).onChainId) {
        throw new BadRequestException(
          'Escrow has no on-chain object ID — cannot execute fund TX',
        );
      }

      const result = await this.execChainTx(() =>
        this.txBuilder.buildFundEscrowTx(
          (escrow as any).onChainId,
          coinObjectId,
          escrow.tokenType,
        ),
      );
      txDigest = result.digest;
    }

    const updated = await this.prisma.escrow.update({
      where: { id: escrowId },
      data: { state: 'FUNDED', version: { increment: 1 } },
    });

    return { escrow: updated, txDigest };
  }

  async release(escrowId: string, amount: number) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, RELEASABLE_STATES);

    const newReleased = Number(escrow.releasedAmount) + amount;
    const total = Number(escrow.totalAmount);

    if (newReleased > total) {
      throw new BadRequestException('Release amount exceeds remaining balance');
    }

    let txDigest = 'dry-run';

    if (!this.isDryRun && (escrow as any).onChainId) {
      const result = await this.execChainTx(() =>
        this.txBuilder.buildReleaseEscrowTx(
          (escrow as any).onChainId,
          BigInt(amount),
          escrow.tokenType,
        ),
      );
      txDigest = result.digest;
    }

    const newState = newReleased >= total ? 'COMPLETED' : 'PARTIALLY_RELEASED';

    const updated = await this.prisma.escrow.update({
      where: { id: escrowId },
      data: {
        releasedAmount: newReleased,
        state: newState,
        version: { increment: 1 },
      },
    });

    return { escrow: updated, txDigest };
  }

  async refund(escrowId: string) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, REFUNDABLE_STATES);

    if (!this.isDryRun && (escrow as any).onChainId) {
      await this.execChainTx(() =>
        this.txBuilder.buildRefundEscrowTx(
          (escrow as any).onChainId,
          escrow.tokenType,
        ),
      );
    }

    const remaining =
      Number(escrow.totalAmount) - Number(escrow.releasedAmount);

    return this.prisma.escrow.update({
      where: { id: escrowId },
      data: {
        refundedAmount: remaining,
        state: 'REFUNDED',
        version: { increment: 1 },
      },
    });
  }

  async raiseDispute(escrowId: string, _raisedBy: string) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, DISPUTABLE_STATES);

    return this.prisma.escrow.update({
      where: { id: escrowId },
      data: { state: 'DISPUTED', version: { increment: 1 } },
    });
  }

  async voteOnDispute(
    escrowId: string,
    voterAddress: string,
    decision: 'release' | 'refund',
  ) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, ['DISPUTED']);

    // Verify voter is an arbitrator
    const arbitrator = await this.prisma.escrowArbitrator.findUnique({
      where: {
        escrowId_address: { escrowId, address: voterAddress },
      },
    });
    if (!arbitrator) {
      throw new BadRequestException('Not an authorized arbitrator');
    }

    // For now, single vote resolves the dispute (threshold logic TBD with chain)
    const newState = decision === 'release' ? 'FUNDED' : 'REFUNDED';

    return this.prisma.escrow.update({
      where: { id: escrowId },
      data: { state: newState, version: { increment: 1 } },
    });
  }

  async getEscrowByDealId(dealId: string) {
    return this.prisma.escrow.findFirst({
      where: { dealId },
      include: {
        vestingSchedule: true,
        arbitrators: true,
        saftTemplates: true,
      },
    });
  }

  async addVesting(escrowId: string, dto: AddVestingDto) {
    await this.findOrThrow(escrowId);

    return this.prisma.vestingSchedule.create({
      data: {
        escrowId,
        vestingType: dto.vestingType,
        cliffMs: dto.cliffMs || 0,
        totalDurationMs: dto.totalDurationMs || 0,
        milestones: dto.milestones || [],
      },
    });
  }

  async completeMilestone(escrowId: string, milestoneIdx: number) {
    const escrow = await this.findOrThrow(escrowId);
    this.assertStateOneOf(escrow, RELEASABLE_STATES);

    const vesting = await this.prisma.vestingSchedule.findUnique({
      where: { escrowId },
    });
    if (!vesting) {
      throw new NotFoundException('No vesting schedule found');
    }

    const milestones = vesting.milestones as any[];
    if (milestoneIdx < 0 || milestoneIdx >= milestones.length) {
      throw new BadRequestException('Invalid milestone index');
    }

    milestones[milestoneIdx] = {
      ...milestones[milestoneIdx],
      completedAt: new Date().toISOString(),
    };

    return this.prisma.vestingSchedule.update({
      where: { escrowId },
      data: { milestones },
    });
  }

  // ── Private helpers ──────────────────────────────

  private async findOrThrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  private assertStateOneOf(escrow: any, validStates: string[]) {
    if (!validStates.includes(escrow.state)) {
      throw new BadRequestException(
        `Invalid state: ${escrow.state}, expected one of: ${validStates.join(', ')}`,
      );
    }
  }
}
