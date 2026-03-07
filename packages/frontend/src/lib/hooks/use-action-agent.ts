import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ActionPlan {
  planId: string;
  targetSegment: string;
  actions: { type: string; config: Record<string, unknown>; delay?: number }[];
  estimatedCost: number;
  createdAt: string;
}

export function usePlanAction() {
  return useMutation({
    mutationFn: (data: { instruction: string }) =>
      apiClient.post<ActionPlan>('/agents/action/plan', data),
  });
}

export function useExecuteAction() {
  return useMutation({
    mutationFn: (data: { planId: string }) =>
      apiClient.post<{ success: boolean }>('/agents/action/execute', data),
  });
}
