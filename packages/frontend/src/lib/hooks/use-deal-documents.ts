import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface CustomPolicyConfig {
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
}

export interface DealDocument {
  id: string;
  dealId: string;
  name: string;
  walrusBlobId: string;
  sealPolicyId?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function useDealDocuments(dealId: string) {
  return useQuery({
    queryKey: ["deal-documents", dealId],
    queryFn: () => apiClient.get<DealDocument[]>(`/deals/${dealId}/documents`),
    enabled: !!dealId,
  });
}

export function useUploadDealDocument(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      encryptedData: string;
      sealPolicyId?: string;
      customPolicy?: CustomPolicyConfig;
      mimeType?: string;
      fileSize?: number;
    }) => apiClient.post<DealDocument>(`/deals/${dealId}/documents`, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["deal-documents", dealId] }),
  });
}

export function useDeleteDealDocument(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, version }: { docId: string; version: number }) =>
      apiClient.delete(`/deals/documents/${docId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["deal-documents", dealId] }),
  });
}

export function useUpdateDocumentPolicy(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      docId,
      policy,
    }: {
      docId: string;
      policy: CustomPolicyConfig;
    }) =>
      apiClient.put<{ success: boolean; policyId: string }>(
        `/deals/documents/${docId}/policy`,
        policy,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["deal-documents", dealId] }),
  });
}
