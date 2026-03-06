import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Message {
  id: string;
  channel: string;
  profileId: string;
  subject: string | null;
  body: string;
  status: string;
  externalId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function useMessageHistory(profileId: string) {
  return useQuery({
    queryKey: ['messaging', 'history', profileId],
    queryFn: () => apiClient.get<{ messages: Message[] }>(`/messaging/history/${profileId}`),
    enabled: !!profileId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      channel: string;
      profileId: string;
      [key: string]: unknown;
    }) => apiClient.post<{ messageId: string; status: string }>('/messaging/send', data),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'history', profileId] });
    },
  });
}
