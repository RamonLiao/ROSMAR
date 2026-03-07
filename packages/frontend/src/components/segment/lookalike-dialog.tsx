'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export interface LookalikeParams {
  topK: number;
  minSimilarity: number;
}

interface LookalikeDialogProps {
  segmentId: string;
  onSubmit: (params: LookalikeParams) => void;
  isPending?: boolean;
}

export function LookalikeDialog({
  segmentId,
  onSubmit,
  isPending,
}: LookalikeDialogProps) {
  const [open, setOpen] = useState(false);
  const [topK, setTopK] = useState(20);
  const [minSimilarity, setMinSimilarity] = useState(0.7);

  const handleSubmit = () => {
    onSubmit({ topK, minSimilarity });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Find Lookalike Audience</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find Lookalike Audience</DialogTitle>
          <DialogDescription>
            Find profiles similar to this segment using feature-based matching.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Top K results: {topK}</Label>
            <Slider
              value={[topK]}
              onValueChange={([v]) => setTopK(v)}
              min={10}
              max={100}
              step={5}
              data-testid="topk-slider"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Min Similarity: {(minSimilarity * 100).toFixed(0)}%
            </Label>
            <Slider
              value={[minSimilarity]}
              onValueChange={([v]) => setMinSimilarity(v)}
              min={0.5}
              max={0.95}
              step={0.05}
              data-testid="similarity-slider"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Searching...' : 'Find Similar Profiles'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
