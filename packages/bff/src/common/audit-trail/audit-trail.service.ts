import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  workspaceId?: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.bffAuditLog.create({ data: entry });
  }

  async logMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.prisma.bffAuditLog.createMany({ data: entries });
  }

  async query(params: {
    workspaceId?: string;
    actor?: string;
    action?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const { workspaceId, actor, action, from, to, limit = 100 } = params;
    return this.prisma.bffAuditLog.findMany({
      where: {
        ...(workspaceId && { workspaceId }),
        ...(actor && { actor }),
        ...(action && { action }),
        ...(from || to
          ? {
              createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000),
    });
  }
}
