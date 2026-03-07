import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface AiConfig {
  provider: string;
  hasApiKey: boolean;
  monthlyQuotaUsd: number;
  usedQuotaUsd: number;
  isEnabled: boolean;
}

export interface AiUsageLog {
  id: string;
  agentType: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai-config'],
    queryFn: () => apiClient.get<AiConfig>('/agent/config'),
  });
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      provider?: string;
      apiKey?: string;
      monthlyQuotaUsd?: number;
      isEnabled?: boolean;
    }) => apiClient.put<AiConfig>('/agent/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    },
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => apiClient.get<{ logs: AiUsageLog[] }>('/agent/usage'),
  });
}
