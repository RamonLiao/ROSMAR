"use client";

import { useCallback } from "react";
import { apiClient } from "@/lib/api/client";

interface CreatePolicyParams {
  name: string;
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
  expiresAtMs?: string;
}

interface CreatePolicyResult {
  policyId: string;
  digest: string;
}

export function useCreatePolicy() {
  const createPolicy = useCallback(
    async (params: CreatePolicyParams): Promise<CreatePolicyResult> => {
      return apiClient.post<CreatePolicyResult>("/vault/policies", params);
    },
    [],
  );

  return { createPolicy };
}
