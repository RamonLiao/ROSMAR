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
    const prismaConditions = rules.conditions.map((c) =>
      this.toPrismaWhere(c),
    );

    const where: Prisma.ProfileWhereInput = {
      workspaceId,
      isArchived: false,
      ...(rules.logic === 'OR'
        ? { OR: prismaConditions }
        : { AND: prismaConditions }),
    };

    const profiles = await this.prisma.profile.findMany({
      where,
      select: { id: true },
    });

    this.logger.debug(
      `Evaluated ${rules.conditions.length} conditions (${rules.logic}): ${profiles.length} profiles matched`,
    );

    return profiles.map((p) => p.id);
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

      default:
        throw new Error(`Unsupported rule field: "${field}"`);
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
