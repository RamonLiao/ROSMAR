'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ScoredProfile {
  profileId: string;
  similarity: number;
}

interface LookalikeResultsProps {
  profiles: ScoredProfile[];
  onCreateSegment: (profileIds: string[]) => void;
  isPending?: boolean;
}

export function LookalikeResults({
  profiles,
  onCreateSegment,
  isPending,
}: LookalikeResultsProps) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No similar profiles found. Try lowering the minimum similarity threshold.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Lookalike Results ({profiles.length})
        </CardTitle>
        <Button
          size="sm"
          onClick={() => onCreateSegment(profiles.map((p) => p.profileId))}
          disabled={isPending}
        >
          Create Segment from Results
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y" data-testid="lookalike-results-list">
          {profiles.map((p) => (
            <li
              key={p.profileId}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm font-mono truncate max-w-[200px]">
                {p.profileId}
              </span>
              <Badge variant="secondary">
                {(p.similarity * 100).toFixed(1)}%
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
