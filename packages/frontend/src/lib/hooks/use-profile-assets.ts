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

// ── NFT Trait Analysis & Rarity ─────────────────────────────

export interface NftTrait {
  name: string;
  value: string;
}

export interface NftWithTraits {
  objectId: string;
  type: string;
  collection: string;
  name: string;
  imageUrl: string | null;
  traits: NftTrait[];
  rarityScore: number | null;
}

export function useNftTraits(profileId: string) {
  return useQuery({
    queryKey: ["nft-traits", profileId],
    queryFn: () =>
      apiClient
        .get<{ nfts: NftWithTraits[] }>(`/profiles/${profileId}/nft-traits`)
        .then((r) => r.nfts),
    enabled: !!profileId,
  });
}

// ── DeFi Position Tracking ──────────────────────────────────

export interface StakePosition {
  validatorAddress: string;
  stakeAmount: string;
  estimatedReward: string;
  stakeActivationEpoch: string;
  status: "active" | "pending" | "unstaked";
}

export interface LpPosition {
  protocol: string;
  poolId: string;
  tokenA: string;
  tokenB: string;
  liquidity: string;
  objectId: string;
}

export interface DefiPositions {
  totalStakedSui: string;
  stakes: StakePosition[];
  lpPositions: LpPosition[];
}

export function useDefiPositions(profileId: string) {
  return useQuery({
    queryKey: ["defi-positions", profileId],
    queryFn: () =>
      apiClient.get<DefiPositions>(`/profiles/${profileId}/defi-positions`),
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
