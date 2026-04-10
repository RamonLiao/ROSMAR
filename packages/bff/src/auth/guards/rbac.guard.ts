import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequirePermissions } from '../decorators/permissions';

export { RequirePermissions };

// Permission bitmask constants (matching Move contract)
export const READ = 1; // 0b000001
export const WRITE = 2; // 0b000010
export const SHARE = 4; // 0b000100
export const DELETE = 8; // 0b001000
export const MANAGE = 16; // 0b010000
export const ADMIN = 31; // 0b011111

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<number>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions = user.permissions || 0;

    // Check if user has required permissions using bitmask
    const hasPermission =
      (userPermissions & requiredPermissions) === requiredPermissions;

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
