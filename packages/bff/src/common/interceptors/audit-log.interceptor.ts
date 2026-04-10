import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = request.url;
    const user = request.user; // Extracted by SessionGuard
    const body = request.body;

    return next.handle().pipe(
      tap({
        next: async (response) => {
          await this.logAudit({
            workspaceId: user?.workspaceId,
            actorAddress: user?.address,
            action: `${method} ${url}`,
            resourceType: this.extractResourceType(url),
            resourceId: this.extractResourceId(url, response),
            changes: body,
            status: 'success',
            timestamp: new Date(),
          });
        },
        error: async (error) => {
          await this.logAudit({
            workspaceId: user?.workspaceId,
            actorAddress: user?.address,
            action: `${method} ${url}`,
            resourceType: this.extractResourceType(url),
            resourceId: null,
            changes: body,
            status: 'failed',
            error: error.message,
            timestamp: new Date(),
          });
        },
      }),
    );
  }

  private async logAudit(data: {
    workspaceId?: string;
    actorAddress?: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    changes: any;
    status: string;
    error?: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO audit_logs (
          workspace_id, actor_address, action, resource_type, resource_id,
          changes, status, error, created_at
        ) VALUES (
          ${data.workspaceId || null},
          ${data.actorAddress || 'system'},
          ${data.action},
          ${data.resourceType},
          ${data.resourceId},
          ${JSON.stringify(data.changes)}::jsonb,
          ${data.status},
          ${data.error || null},
          ${data.timestamp}
        )
      `;
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private extractResourceType(url: string): string {
    // Extract resource from URL: /api/profiles/:id -> "profile"
    const match = url.match(/\/api\/([^/]+)/);
    return match ? match[1].replace(/s$/, '') : 'unknown';
  }

  private extractResourceId(url: string, response: any): string | null {
    // Try to extract ID from URL params
    const match = url.match(/\/([a-f0-9-]{36}|\w+)$/);
    if (match) {
      return match[1];
    }

    // Try to extract from response (for POST operations)
    if (response && typeof response === 'object') {
      return (
        response.id ||
        response.profileId ||
        response.organizationId ||
        response.dealId ||
        null
      );
    }

    return null;
  }
}
