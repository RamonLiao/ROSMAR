import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const ALLOWED_FIELDS = [
  'tier',
  'engagementScore',
  'tags',
  'primaryAddress',
  'isArchived',
] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in';

export interface ConditionConfig {
  field: AllowedField;
  operator: ConditionOperator;
  value: any;
}

export interface ConditionResult {
  branch: 'yes' | 'no';
}

@Injectable()
export class ConditionAction {
  private readonly logger = new Logger(ConditionAction.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    profileId: string,
    config: ConditionConfig,
  ): Promise<ConditionResult> {
    if (!config.field || !config.operator) {
      throw new Error('field and operator are required for condition action');
    }

    if (!ALLOWED_FIELDS.includes(config.field)) {
      throw new Error(
        `Field "${config.field}" not allowed. Allowed: ${ALLOWED_FIELDS.join(', ')}`,
      );
    }

    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: {
        tier: true,
        engagementScore: true,
        tags: true,
        primaryAddress: true,
        isArchived: true,
      },
    });

    const fieldValue = profile[config.field];
    const match = this.evaluate(fieldValue, config.operator, config.value);

    this.logger.log(
      `Condition ${config.field} ${config.operator} ${config.value} → ${match ? 'yes' : 'no'} (profile ${profileId})`,
    );

    return { branch: match ? 'yes' : 'no' };
  }

  private evaluate(
    fieldValue: any,
    operator: ConditionOperator,
    targetValue: any,
  ): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === targetValue;
      case 'neq':
        return fieldValue !== targetValue;
      case 'gt':
        return fieldValue > targetValue;
      case 'gte':
        return fieldValue >= targetValue;
      case 'lt':
        return fieldValue < targetValue;
      case 'lte':
        return fieldValue <= targetValue;
      case 'contains':
        // For arrays (tags) or strings
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(targetValue);
        }
        return String(fieldValue).includes(String(targetValue));
      case 'in':
        // fieldValue is in targetValue array
        if (Array.isArray(targetValue)) {
          return targetValue.includes(fieldValue);
        }
        return false;
      default:
        return false;
    }
  }
}
