import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RuleCondition {
  field: string;
  operator: string;
  value: any;
}

export interface SegmentRules {
  conditions: RuleCondition[];
  logic: 'AND' | 'OR';
}

@Injectable()
export class RuleEvaluatorService {
  private readonly logger = new Logger(RuleEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(workspaceId: string, rules: SegmentRules): Promise<string[]> {
    // Split conditions into Prisma-native vs raw-SQL paths
    const discordConditions = rules.conditions.filter(
      (c) => c.field === 'discord_role',
    );
    const tokenBalConditions = rules.conditions.filter(
      (c) => c.field === 'token_balance',
    );
    const prismaConditions = rules.conditions.filter(
      (c) => c.field !== 'discord_role' && c.field !== 'token_balance',
    );

    const resultSets: string[][] = [];

    // 1. Prisma-native conditions (tags, tier, engagement_score, wallet_chain, created_after, nft_collection)
    if (prismaConditions.length > 0) {
      const mapped = prismaConditions.map((c) => this.toPrismaWhere(c));
      const where: Prisma.ProfileWhereInput = {
        workspaceId,
        isArchived: false,
        ...(rules.logic === 'OR' ? { OR: mapped } : { AND: mapped }),
      };
      const profiles = await this.prisma.profile.findMany({
        where,
        select: { id: true },
      });
      resultSets.push(profiles.map((p) => p.id));
    }

    // 2. Token balance (raw SQL)
    if (tokenBalConditions.length > 0) {
      resultSets.push(
        await this.evaluateTokenBalance(
          workspaceId,
          tokenBalConditions,
          rules.logic,
        ),
      );
    }

    // 3. Discord role (raw SQL)
    if (discordConditions.length > 0) {
      resultSets.push(
        await this.evaluateDiscordRoles(
          workspaceId,
          discordConditions,
          rules.logic,
        ),
      );
    }

    // Combine result sets
    let result: string[];
    if (resultSets.length === 0) {
      result = [];
    } else if (resultSets.length === 1) {
      result = resultSets[0];
    } else if (rules.logic === 'AND') {
      // Intersection
      const [first, ...rest] = resultSets;
      const sets = rest.map((s) => new Set(s));
      result = first.filter((id) => sets.every((s) => s.has(id)));
    } else {
      // Union
      result = [...new Set(resultSets.flat())];
    }

    this.logger.debug(
      `Evaluated ${rules.conditions.length} conditions (${rules.logic}): ${result.length} profiles matched`,
    );

    return result;
  }

  toPrismaWhere(condition: RuleCondition): Prisma.ProfileWhereInput {
    const { field, operator, value } = condition;

    switch (field) {
      case 'tags':
        if (operator === 'contains') {
          return { tags: { has: value } };
        }
        throw new Error(`Unsupported operator "${operator}" for field "tags"`);

      case 'tier':
        return { tier: this.numericFilter(operator, value) };

      case 'engagement_score':
        return { engagementScore: this.numericFilter(operator, value) };

      case 'wallet_chain':
        return {
          wallets: {
            some: { chain: this.stringFilter(operator, value) },
          },
        };

      case 'created_after':
        return { createdAt: { gte: new Date(value) } };

      case 'nft_collection': {
        const matchFilter = {
          assetType: 'nft',
          rawBalance: { gt: new Prisma.Decimal(0) },
          OR: [
            {
              collectionName: {
                contains: value as string,
                mode: 'insensitive' as const,
              },
            },
            { contractAddress: value as string },
          ],
        };
        if (operator === 'holds') {
          return { walletBalances: { some: matchFilter } };
        }
        if (operator === 'not_holds') {
          return { walletBalances: { none: matchFilter } };
        }
        throw new Error(
          `Unsupported operator "${operator}" for field "nft_collection"`,
        );
      }

      default:
        throw new Error(`Unsupported rule field: "${field}"`);
    }
  }

  private async evaluateTokenBalance(
    workspaceId: string,
    conditions: RuleCondition[],
    logic: 'AND' | 'OR',
  ): Promise<string[]> {
    const fragments = conditions.map((c) => {
      let parsed: { token: string; amount: string };
      try {
        parsed = JSON.parse(c.value as string);
      } catch {
        throw new Error(
          'token_balance value must be JSON: {"token":"SUI","amount":"100"}',
        );
      }
      if (!parsed.token || !parsed.amount || isNaN(Number(parsed.amount))) {
        throw new Error(
          'token_balance value must be JSON: {"token":"SUI","amount":"100"}',
        );
      }
      const sqlOp = this.toSqlOperator(c.operator);
      return `(wb.token_symbol = '${parsed.token}' AND wb.raw_balance ${sqlOp} ${parsed.amount} * power(10, wb.decimals))`;
    });

    const joiner = logic === 'AND' ? ' AND ' : ' OR ';

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT p.id
        FROM profiles p
        JOIN wallet_balances wb ON wb.profile_id = p.id
        WHERE p.workspace_id = ${workspaceId}
          AND p.is_archived = false
          AND wb.asset_type = 'token'
          AND (${Prisma.raw(fragments.join(joiner))})
      `,
    );

    return rows.map((r) => r.id);
  }

  private async evaluateDiscordRoles(
    workspaceId: string,
    conditions: RuleCondition[],
    logic: 'AND' | 'OR',
  ): Promise<string[]> {
    const fragmentStrings = conditions.map((c) => {
      const roleId = c.value as string;
      if (c.operator === 'has_role') {
        return `sl.metadata->'roles' @> '"${roleId}"'::jsonb`;
      }
      if (c.operator === 'not_has_role') {
        return `NOT (COALESCE(sl.metadata->'roles', '[]'::jsonb) @> '"${roleId}"'::jsonb)`;
      }
      throw new Error(
        `Unsupported operator "${c.operator}" for field "discord_role"`,
      );
    });

    const joiner = logic === 'AND' ? ' AND ' : ' OR ';
    const combinedClause = fragmentStrings.join(joiner);

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT p.id
        FROM profiles p
        JOIN social_links sl ON sl.profile_id = p.id AND sl.platform = 'discord'
        WHERE p.workspace_id = ${workspaceId}
          AND p.is_archived = false
          AND (${Prisma.raw(combinedClause)})
      `,
    );

    this.logger.debug(`Discord role eval: ${rows.length} profiles matched`);
    return rows.map((r) => r.id);
  }

  private toSqlOperator(operator: string): string {
    switch (operator) {
      case 'gte':
        return '>=';
      case 'gt':
        return '>';
      case 'lte':
        return '<=';
      case 'lt':
        return '<';
      default:
        throw new Error(`Unsupported numeric operator: "${operator}"`);
    }
  }

  private numericFilter(
    operator: string,
    value: number,
  ): number | Prisma.IntFilter {
    switch (operator) {
      case 'equals':
        return value;
      case 'gte':
        return { gte: value };
      case 'gt':
        return { gt: value };
      case 'lte':
        return { lte: value };
      case 'lt':
        return { lt: value };
      default:
        throw new Error(`Unsupported numeric operator: "${operator}"`);
    }
  }

  private stringFilter(operator: string, value: string): string {
    if (operator === 'equals') return value;
    throw new Error(`Unsupported string operator: "${operator}"`);
  }
}
