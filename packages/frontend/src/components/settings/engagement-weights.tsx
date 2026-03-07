"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useEngagementSettings,
  type EngagementWeights as Weights,
} from "@/lib/hooks/use-engagement-settings";

const LABELS: Record<keyof Weights, string> = {
  holdTime: "Hold Time",
  txCount: "TX Count",
  txValue: "TX Value",
  voteCount: "Vote Count",
  nftCount: "NFT Count",
};

export function EngagementWeights() {
  const { weights, setWeight, reset, total } = useEngagementSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Score Weights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(LABELS) as (keyof Weights)[]).map((key) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>{LABELS[key]}</Label>
              <span className="text-sm text-muted-foreground">
                {weights[key].toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(weights[key] * 100)}
              onChange={(e) => setWeight(key, Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">Total: {total.toFixed(1)}</span>
          <Button variant="outline" size="sm" onClick={reset}>
            Reset Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
