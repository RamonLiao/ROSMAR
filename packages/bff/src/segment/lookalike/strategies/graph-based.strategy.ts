import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileFeatureVector } from '../feature-extraction.service';
import { ScoredProfile, SimilarityStrategy } from '../interfaces';
import { cosineSimilarity } from './knn-cosine.strategy';

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface NeighborMap {
  [profileId: string]: Set<string>;
}

@Injectable()
export class GraphBasedStrategy implements SimilarityStrategy {
  readonly name = 'graph-based';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build neighbor sets from WalletEvent data.
   * A profile's "neighbors" = set of:
   *   - txDigests it shares with other addresses (co-occurrence in same tx)
   *   - contractAddresses it has interacted with (protocol affinity)
   */
  async buildNeighborMap(profileIds: string[]): Promise<NeighborMap> {
    if (profileIds.length === 0) return {};

    // Get all addresses belonging to these profiles
    const wallets = await this.prisma.profileWallet.findMany({
      where: { profileId: { in: profileIds } },
      select: { profileId: true, address: true },
    });
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, primaryAddress: true },
    });

    // profileId → [addresses]
    const profileAddresses: Record<string, string[]> = {};
    for (const p of profiles) {
      profileAddresses[p.id] = [p.primaryAddress.toLowerCase()];
    }
    for (const w of wallets) {
      if (!profileAddresses[w.profileId]) profileAddresses[w.profileId] = [];
      profileAddresses[w.profileId].push(w.address.toLowerCase());
    }

    const allAddresses = Object.values(profileAddresses).flat();
    if (allAddresses.length === 0) {
      const empty: NeighborMap = {};
      for (const pid of profileIds) empty[pid] = new Set();
      return empty;
    }

    // Fetch events for these addresses
    const events = await this.prisma.walletEvent.findMany({
      where: { address: { in: allAddresses } },
      select: { address: true, txDigest: true, contractAddress: true },
    });

    // address → profileId reverse map
    const addressToProfile: Record<string, string> = {};
    for (const [profileId, addrs] of Object.entries(profileAddresses)) {
      for (const addr of addrs) addressToProfile[addr] = profileId;
    }

    // Build neighbor sets: txDigest + contractAddress as "interaction fingerprint"
    const neighborMap: NeighborMap = {};
    for (const pid of profileIds) neighborMap[pid] = new Set();

    for (const evt of events) {
      const profileId = addressToProfile[evt.address.toLowerCase()];
      if (!profileId) continue;
      // Each unique txDigest and contractAddress is a "neighbor" in the interaction graph
      neighborMap[profileId].add(`tx:${evt.txDigest}`);
      if (evt.contractAddress) {
        neighborMap[profileId].add(
          `contract:${evt.contractAddress.toLowerCase()}`,
        );
      }
    }

    return neighborMap;
  }

  /**
   * Hybrid scoring: α * cosine(featureVec) + (1-α) * jaccard(neighbors)
   * Falls back to pure cosine when no graph data exists.
   */
  findSimilarWithGraph(
    seeds: ProfileFeatureVector[],
    candidates: ProfileFeatureVector[],
    seedNeighbors: NeighborMap,
    candidateNeighbors: NeighborMap,
    topK: number,
    minSimilarity?: number,
    alpha = 0.5,
  ): ScoredProfile[] {
    if (seeds.length === 0 || candidates.length === 0) return [];

    // Compute seed centroid for cosine component
    const dims = seeds[0].vector.length;
    const centroid = new Array(dims).fill(0);
    for (const s of seeds) {
      for (let i = 0; i < dims; i++) centroid[i] += s.vector[i];
    }
    for (let i = 0; i < dims; i++) centroid[i] /= seeds.length;

    // Merge seed neighbors into one set for Jaccard
    const seedNeighborUnion = new Set<string>();
    for (const s of seeds) {
      const neighbors = seedNeighbors[s.profileId];
      if (neighbors) for (const n of neighbors) seedNeighborUnion.add(n);
    }

    const scored: ScoredProfile[] = candidates.map((c) => {
      const cosScore = cosineSimilarity(c.vector, centroid);
      const candidateNeighborSet = candidateNeighbors[c.profileId] ?? new Set();
      const jacScore = jaccardSimilarity(
        seedNeighborUnion,
        candidateNeighborSet,
      );

      const hasGraphData =
        seedNeighborUnion.size > 0 || candidateNeighborSet.size > 0;
      const similarity = hasGraphData
        ? alpha * cosScore + (1 - alpha) * jacScore
        : cosScore;

      return { profileId: c.profileId, similarity };
    });

    let filtered = scored;
    if (minSimilarity !== undefined) {
      filtered = scored.filter((s) => s.similarity >= minSimilarity);
    }

    return filtered.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  // SimilarityStrategy interface — stateless fallback (no graph data = pure cosine)
  findSimilar(
    seeds: ProfileFeatureVector[],
    candidates: ProfileFeatureVector[],
    topK: number,
    minSimilarity?: number,
  ): ScoredProfile[] {
    return this.findSimilarWithGraph(
      seeds,
      candidates,
      {},
      {},
      topK,
      minSimilarity,
      1.0,
    );
  }
}
