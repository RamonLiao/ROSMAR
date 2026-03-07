import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface AnalystResult {
  summary: string;
  data: any[];
  chartConfig?: { type: string; xKey: string; yKey: string };
}

export function useAnalystQuery() {
  return useMutation({
    mutationFn: (query: string) =>
      apiClient.post<AnalystResult>('/agents/analyst/query', { query }),
  });
}
