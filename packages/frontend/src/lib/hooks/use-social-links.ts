import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface SocialLink {
  id: string;
  platform: string;
  platformUserId: string;
  platformUsername: string | null;
  verified: boolean;
  linkedAt: string;
}

export function useSocialLinks(profileId: string) {
  return useQuery({
    queryKey: ['social-links', profileId],
    queryFn: () =>
      apiClient.get<{ links: SocialLink[] }>(`/social/${profileId}/links`),
    enabled: !!profileId,
    select: (data) => data.links,
  });
}

export function useLinkSocial(platform: 'discord' | 'x') {
  return useMutation({
    mutationFn: async (profileId: string) => {
      const data = await apiClient.get<{ url: string }>(
        `/social/${platform}/auth-url?profileId=${profileId}`,
      );
      // Open OAuth popup with fixed dimensions
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.url,
        `${platform}-oauth`,
        `width=${width},height=${height},left=${left},top=${top}`,
      );
      return data;
    },
  });
}

export function useUnlinkSocial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      platform,
    }: {
      profileId: string;
      platform: string;
    }) => {
      return apiClient.delete<{ success: boolean }>(
        `/social/${profileId}/${platform}`,
      );
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['social-links', profileId] });
    },
  });
}

export function useLinkApple() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      zkLoginAddress,
    }: {
      profileId: string;
      zkLoginAddress: string;
    }) => {
      return apiClient.post<{ success: boolean }>(
        `/social/${profileId}/apple`,
        { zkLoginAddress },
      );
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['social-links', profileId] });
    },
  });
}
