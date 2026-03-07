export interface StepVerifier {
  verify(
    profileId: string,
    step: { actionType: string; actionConfig: Record<string, unknown> },
    claimData: Record<string, unknown>,
  ): Promise<{ verified: boolean; txDigest?: string }>;
}
