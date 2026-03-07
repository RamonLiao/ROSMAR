'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuestStepEditor, StepFormData } from './quest-step-editor';

const REWARD_TYPES = ['BADGE', 'TOKEN', 'NFT', 'POINTS'] as const;

interface QuestBuilderProps {
  onSubmit: (data: {
    name: string;
    description?: string;
    rewardType: string;
    steps: StepFormData[];
  }) => void;
  isPending?: boolean;
}

const DEFAULT_STEP: StepFormData = {
  title: '',
  actionType: 'SWAP',
  verificationMethod: 'INDEXER',
  chain: 'SUI',
};

export function QuestBuilder({ onSubmit, isPending }: QuestBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rewardType, setRewardType] = useState('BADGE');
  const [steps, setSteps] = useState<StepFormData[]>([{ ...DEFAULT_STEP }]);

  const addStep = () => {
    setSteps((prev) => [...prev, { ...DEFAULT_STEP }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, step: StepFormData) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? step : s)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      rewardType,
      steps,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="quest-name">Quest Name</Label>
        <Input
          id="quest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter quest name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quest-description">Description</Label>
        <Input
          id="quest-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      <div className="space-y-2">
        <Label>Reward Type</Label>
        <Select value={rewardType} onValueChange={setRewardType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REWARD_TYPES.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {rt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Steps ({steps.length})</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            Add Step
          </Button>
        </div>

        {steps.map((step, i) => (
          <QuestStepEditor
            key={i}
            index={i}
            step={step}
            onChange={(s) => updateStep(i, s)}
            onRemove={() => removeStep(i)}
          />
        ))}
      </div>

      <Button type="submit" disabled={isPending || !name || steps.length === 0}>
        {isPending ? 'Creating...' : 'Create Quest'}
      </Button>
    </form>
  );
}
