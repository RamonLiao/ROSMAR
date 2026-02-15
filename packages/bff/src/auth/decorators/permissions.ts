import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route
 * @param permissions - Bitmask of required permissions
 * @example @RequirePermissions(WRITE | SHARE)
 */
export const RequirePermissions = (permissions: number) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
