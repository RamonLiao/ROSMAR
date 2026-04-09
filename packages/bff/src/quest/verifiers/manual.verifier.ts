import { Injectable } from '@nestjs/common';
import { StepVerifier } from './step-verifier.interface';

@Injectable()
export class ManualVerifier implements StepVerifier {
  async verify(
    _profileId: string,
    _step: { actionType: string; actionConfig: Record<string, unknown> },
    _claimData: Record<string, unknown>,
  ): Promise<{ verified: boolean; txDigest?: string; pendingApproval?: boolean }> {
    // Manual verification always returns pending — admin must approve
    return { verified: false, pendingApproval: true };
  }
}
