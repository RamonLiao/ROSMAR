import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_CAPS,
  DEFAULT_WEIGHTS,
  EngagementWeights,
} from './engagement.constants';

export interface ScoreResult {
  score: number; // 0-100
  breakdown: {
    holdTime: number;
    txCount: number;
    txValue: number;
    voteCount: number;
    nftCount: number;
  };
}

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateScore(
    profileId: string,
    weights: EngagementWeights = DEFAULT_WEIGHTS,
  ): Promise<ScoreResult> {
    const rows = await this.prisma.$queryRaw<
      {
        hold_days: number;
        tx_count: bigint;
        tx_value: number;
        vote_count: bigint;
        nft_count: bigint;
      }[]
    >`
      SELECT
        COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(we.time))) / 86400, 0)::float AS hold_days,
        COUNT(*) FILTER (WHERE we.event_type IN ('SwapEvent', 'AddLiquidityEvent', 'StakeEvent', 'UnstakeEvent')) AS tx_count,
        COALESCE(SUM(we.amount) FILTER (WHERE we.event_type IN ('SwapEvent', 'AddLiquidityEvent')), 0)::float AS tx_value,
        COUNT(*) FILTER (WHERE we.event_type IN ('VoteEvent', 'DelegateEvent')) AS vote_count,
        COUNT(*) FILTER (WHERE we.event_type IN ('MintNFTEvent', 'TransferObject')) AS nft_count
      FROM wallet_events we
      WHERE we.profile_id = ${profileId}
    `;

    const raw = rows[0] ?? {
      hold_days: 0,
      tx_count: 0n,
      tx_value: 0,
      vote_count: 0n,
      nft_count: 0n,
    };

    const factors = {
      holdTime: Math.min(Number(raw.hold_days) / DEFAULT_CAPS.holdTimeDays, 1),
      txCount: Math.min(Number(raw.tx_count) / DEFAULT_CAPS.txCount, 1),
      txValue: Math.min(Number(raw.tx_value) / DEFAULT_CAPS.txValueUsd, 1),
      voteCount: Math.min(Number(raw.vote_count) / DEFAULT_CAPS.voteCount, 1),
      nftCount: Math.min(Number(raw.nft_count) / DEFAULT_CAPS.nftCount, 1),
    };

    const score = Math.round(
      (factors.holdTime * weights.holdTime +
        factors.txCount * weights.txCount +
        factors.txValue * weights.txValue +
        factors.voteCount * weights.voteCount +
        factors.nftCount * weights.nftCount) *
        100,
    );

    return {
      score: Math.min(score, 100),
      breakdown: {
        holdTime: Math.round(factors.holdTime * 100),
        txCount: Math.round(factors.txCount * 100),
        txValue: Math.round(factors.txValue * 100),
        voteCount: Math.round(factors.voteCount * 100),
        nftCount: Math.round(factors.nftCount * 100),
      },
    };
  }

  async recalculateAndPersist(
    profileId: string,
    workspaceId: string,
  ): Promise<number> {
    // Load per-workspace custom weights (falls back to DEFAULT_WEIGHTS)
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { engagementWeights: true },
    });
    const weights: EngagementWeights =
      (ws?.engagementWeights as EngagementWeights | null) ?? DEFAULT_WEIGHTS;

    const result = await this.calculateScore(profileId, weights);

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { engagementScore: result.score },
    });

    await this.prisma.engagementSnapshot.create({
      data: {
        profileId,
        workspaceId,
        score: result.score,
        breakdown: result.breakdown,
        calculatedAt: new Date(),
      },
    });

    return result.score;
  }
}
