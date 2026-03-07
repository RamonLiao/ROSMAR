import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTO_TAG_PREFIX, TAG_RULES } from './auto-tag.constants';

@Injectable()
export class AutoTagService {
  private readonly logger = new Logger(AutoTagService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeAutoTags(profileId: string): Promise<string[]> {
    const tags: string[] = [];

    for (const rule of TAG_RULES) {
      const match = await this.evaluateRule(profileId, rule);
      if (match) {
        tags.push(`${AUTO_TAG_PREFIX}${rule.tag}`);
      }
    }

    return tags;
  }

  private async evaluateRule(
    profileId: string,
    rule: (typeof TAG_RULES)[number],
  ): Promise<boolean> {
    const eventTypes = rule.eventTypes;
    const since = this.periodToDate(rule.period);

    if ('minAmountUsd' in rule && rule.minAmountUsd) {
      // Sum-based rule (whale)
      const rows = await this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM wallet_events
        WHERE profile_id = ${profileId}
          AND event_type = ANY(${eventTypes}::text[])
          AND (${since}::timestamptz IS NULL OR time >= ${since}::timestamptz)
      `;
      return (rows[0]?.total ?? 0) >= rule.minAmountUsd;
    }

    // Count-based rule
    const rows = await this.prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt
      FROM wallet_events
      WHERE profile_id = ${profileId}
        AND event_type = ANY(${eventTypes}::text[])
        AND (${since}::timestamptz IS NULL OR time >= ${since}::timestamptz)
    `;
    const minCount = 'minCount' in rule ? rule.minCount : 0;
    return Number(rows[0]?.cnt ?? 0) >= minCount;
  }

  private periodToDate(period: string): Date | null {
    if (period === 'all') return null;
    const days = parseInt(period);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  /**
   * Merge: keep manual tags, replace all auto: tags with fresh computed set
   */
  mergeTags(existingTags: string[], autoTags: string[]): string[] {
    const manual = existingTags.filter((t) => !t.startsWith(AUTO_TAG_PREFIX));
    return [...manual, ...autoTags];
  }
}
