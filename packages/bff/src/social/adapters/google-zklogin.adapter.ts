import { Injectable } from '@nestjs/common';

/**
 * Google ZkLogin adapter.
 * Google auth is handled by Enoki's ZkLogin flow — no separate OAuth needed.
 * This adapter decodes the JWT to extract user claims.
 */
@Injectable()
export class GoogleZkLoginAdapter {
  /**
   * Decode a JWT without verification (Enoki API handles verification).
   * Returns the payload claims.
   */
  decodeJwt(jwt: string): { sub: string; email?: string; name?: string; picture?: string } {
    const parts = jwt.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
