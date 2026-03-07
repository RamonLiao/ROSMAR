import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

interface DealDocument {
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
