import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface NftAsset {
  collection: string;
  count: number;
  eventType: string;
}

export interface NftDisplayItem {
  objectId: string;
  type: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  ownerAddress: string;
}

export interface DefiPosition {
  type: string;
  count: number;
  totalAmount: number;
}

export interface GovernanceActivity {
  type: string;
  count: number;
}

export interface ProfileAssets {
  nfts: NftAsset[];
  nftGallery: NftDisplayItem[];
  defi: DefiPosition[];
  governance: GovernanceActivity[];
}

export interface TimelineEvent {
  id: string;
  time: string;
  eventType: string;
  collection?: string;
  token?: string;
  amount?: number;
  txDigest: string;
}

export interface TimelineResult {
  events: TimelineEvent[];
  total: number;
}

export function useProfileAssets(profileId: string) {
  return useQuery({
    queryKey: ["profile-assets", profileId],
    queryFn: () =>
      apiClient.get<ProfileAssets>(`/profiles/${profileId}/assets`),
    enabled: !!profileId,
  });
}

export function useProfileTimeline(
  profileId: string,
  limit = 20,
  offset = 0,
) {
  return useQuery({
    queryKey: ["profile-timeline", profileId, limit, offset],
    queryFn: () =>
      apiClient.get<TimelineResult>(
        `/profiles/${profileId}/timeline?limit=${limit}&offset=${offset}`,
      ),
    enabled: !!profileId,
  });
}
