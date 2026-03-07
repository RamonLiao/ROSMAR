import { Injectable } from '@nestjs/common';
import { StepVerifier } from './step-verifier.interface';

@Injectable()
export class RpcVerifier implements StepVerifier {
  async verify(
    profileId: string,
    step: { actionType: string; actionConfig: Record<string, unknown> },
    claimData: Record<string, unknown>,
  ): Promise<{ verified: boolean; txDigest?: string }> {
    const txDigest = claimData?.txDigest as string;

    if (!txDigest) {
      return { verified: false };
    }

    // In production, this would call SuiClient.getTransactionBlock(txDigest)
    // and verify the transaction matches the step requirements.
    // For now, we trust the provided txDigest if it exists.
    return { verified: true, txDigest };
  }
}
