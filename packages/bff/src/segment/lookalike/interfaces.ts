import { ProfileFeatureVector } from './feature-extraction.service';

export interface ScoredProfile {
  profileId: string;
  similarity: number;
}

export interface SimilarityStrategy {
  readonly name: string;
  findSimilar(
    seeds: ProfileFeatureVector[],
    candidates: ProfileFeatureVector[],
    topK: number,
    minSimilarity?: number,
  ): ScoredProfile[];
}

export interface CandidateSource {
  readonly name: string;
  getCandidates(
    workspaceId: string,
    excludeIds: string[],
  ): Promise<string[]>;
}
