import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface ScoreBucket {
  range: string;
  count: number;
}

interface ActivityCell {
  day: string;
  hour: number;
  activity: number;
}

export function useScoreDistribution() {
  return useQuery({
    queryKey: ['analytics', 'score-distribution'],
    queryFn: () => apiClient.get<ScoreBucket[]>('/analytics/score-distribution'),
  });
}

export function useActivityHeatmap() {
  return useQuery({
    queryKey: ['analytics', 'activity-heatmap'],
    queryFn: () => apiClient.get<ActivityCell[]>('/analytics/activity-heatmap'),
  });
}
