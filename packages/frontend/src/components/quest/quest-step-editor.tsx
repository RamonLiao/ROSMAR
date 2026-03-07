'use client';

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

export const ACTION_TYPES = [
  'SWAP',
  'STAKE',
  'BRIDGE',
  'MINT_NFT',
  'VOTE',
  'HOLD_TOKEN',
  'SOCIAL_FOLLOW',
  'CUSTOM',
] as const;

export const VERIFICATION_METHODS = ['INDEXER', 'RPC', 'MANUAL'] as const;
export const CHAINS = ['SUI', 'EVM', 'SOLANA'] as const;

export interface StepFormData {
  title: string;
  actionType: string;
  verificationMethod: string;
  chain: string;
  description?: string;
}

interface QuestStepEditorProps {
  index: number;
  step: StepFormData;
  onChange: (step: StepFormData) => void;
  onRemove: () => void;
}

export function QuestStepEditor({
  index,
  step,
  onChange,
  onRemove,
}: QuestStepEditorProps) {
  const update = (field: keyof StepFormData, value: string) => {
    onChange({ ...step, [field]: value });
  };

  return (
    <div
      className="border rounded-lg p-4 space-y-3"
      data-testid={`step-editor-${index}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Step {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove step ${index + 1}`}
        >
          Remove
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`step-title-${index}`}>Title</Label>
        <Input
          id={`step-title-${index}`}
          value={step.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Step title"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Action Type</Label>
          <Select
            value={step.actionType}
            onValueChange={(v) => update('actionType', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Verification</Label>
          <Select
            value={step.verificationMethod}
            onValueChange={(v) => update('verificationMethod', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Chain</Label>
          <Select
            value={step.chain}
            onValueChange={(v) => update('chain', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent>
              {CHAINS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
