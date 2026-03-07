import { ProfileFeatureVector } from '../feature-extraction.service';

export interface ScoredProfile {
  profileId: string;
  similarity: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export class KnnCosineStrategy {
  computeCentroid(seeds: ProfileFeatureVector[]): number[] {
    if (seeds.length === 0) return [];
    const dims = seeds[0].vector.length;
    const sum = new Array(dims).fill(0);
    for (const s of seeds) {
      for (let i = 0; i < dims; i++) {
        sum[i] += s.vector[i];
      }
    }
    return sum.map((v) => v / seeds.length);
  }

  findSimilar(
    seeds: ProfileFeatureVector[],
    candidates: ProfileFeatureVector[],
    topK: number,
    minSimilarity?: number,
  ): ScoredProfile[] {
    const centroid = this.computeCentroid(seeds);

    const scored: ScoredProfile[] = candidates.map((c) => ({
      profileId: c.profileId,
      similarity: cosineSimilarity(c.vector, centroid),
    }));

    let filtered = scored;
    if (minSimilarity !== undefined) {
      filtered = scored.filter((s) => s.similarity >= minSimilarity);
    }

    return filtered.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}
