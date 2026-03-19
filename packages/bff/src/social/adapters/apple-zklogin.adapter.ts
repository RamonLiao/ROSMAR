import { Injectable } from '@nestjs/common';

/**
 * Apple ZkLogin adapter.
 * Apple auth is handled by Enoki's ZkLogin flow — no separate OAuth needed.
 * This adapter decodes the JWT to extract user claims.
 */
@Injectable()
export class AppleZkLoginAdapter {
  /**
   * Decode an Apple JWT without verification (Enoki API handles verification).
   * Apple ID tokens contain sub + email.
   */
  decodeJwt(jwt: string): { sub: string; email?: string } {
    const parts = jwt.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return {
      sub: payload.sub,
      email: payload.email,
    };
  }

  /**
   * Validate that the provided address looks like a valid Sui address.
   * Kept for backwards compatibility.
   */
  validateAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(address);
  }
}
