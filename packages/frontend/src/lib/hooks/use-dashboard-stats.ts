import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface DashboardStats {
  profileCount: number;
  dealCount: number;
  pipelineTotal: number;
  segmentCount: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [profiles, deals, segments] = await Promise.all([
        apiClient.get<{ total: number }>('/profiles?limit=0'),
        apiClient.get<{ deals: { amountUsd: number }[]; total: number }>('/deals?limit=100'),
        apiClient.get<{ total: number }>('/segments?limit=0'),
      ]);

      const pipelineTotal = (deals.deals ?? []).reduce(
        (sum, d) => sum + Number(d.amountUsd),
        0
      );

      return {
        profileCount: profiles.total ?? 0,
        dealCount: deals.total ?? 0,
        pipelineTotal,
        segmentCount: segments.total ?? 0,
      } satisfies DashboardStats;
    },
  });
}
