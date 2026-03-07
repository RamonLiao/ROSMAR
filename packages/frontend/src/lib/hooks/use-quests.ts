import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface QuestStep {
  id: string;
  questId: string;
  orderIndex: number;
  title: string;
  description?: string;
  actionType: string;
  actionConfig: unknown;
  verificationMethod: string;
  chain: string;
}

export interface Quest {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  rewardType: string;
  rewardConfig: unknown;
  steps: QuestStep[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestStepCompletion {
  stepId: string;
  completedAt: string;
}

export interface QuestProgress {
  questId: string;
  profileId: string;
  completedSteps: QuestStepCompletion[];
  isCompleted: boolean;
}

export function useQuests(workspaceId?: string) {
  return useQuery({
    queryKey: ['quests', workspaceId],
    queryFn: () => apiClient.get<{ quests: Quest[] }>('/quests'),
    enabled: !!workspaceId,
  });
}

export function useQuest(id: string) {
  return useQuery({
    queryKey: ['quest', id],
    queryFn: () => apiClient.get<Quest>(`/quests/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      rewardType: string;
      rewardConfig?: unknown;
      steps: Array<{
        title: string;
        actionType: string;
        verificationMethod: string;
        chain: string;
        description?: string;
        actionConfig?: unknown;
      }>;
    }) => apiClient.post<{ id: string }>('/quests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}

export function useUpdateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      isActive?: boolean;
      rewardType?: string;
    }) => apiClient.put<Quest>(`/quests/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['quest', id] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}

export function useClaimStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questId,
      stepId,
    }: {
      questId: string;
      stepId: string;
    }) =>
      apiClient.post<{ success: boolean }>(
        `/quests/${questId}/steps/${stepId}/claim`,
      ),
    onSuccess: (_, { questId }) => {
      queryClient.invalidateQueries({ queryKey: ['quest-progress', questId] });
    },
  });
}

export function useQuestProgress(questId: string, profileId: string) {
  return useQuery({
    queryKey: ['quest-progress', questId, profileId],
    queryFn: () =>
      apiClient.get<QuestProgress>(
        `/quests/${questId}/progress/${profileId}`,
      ),
    enabled: !!questId && !!profileId,
  });
}
