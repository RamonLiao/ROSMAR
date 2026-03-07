import { Injectable } from '@nestjs/common';

/**
 * Apple ZkLogin adapter.
 * Apple auth is handled by Enoki's ZkLogin flow — no separate OAuth needed.
 * This adapter simply creates a SocialLink record from the zkLogin address.
 */
@Injectable()
export class AppleZkLoginAdapter {
  /**
   * Validate that the provided address looks like a valid Sui address.
   */
  validateAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(address);
  }
}
