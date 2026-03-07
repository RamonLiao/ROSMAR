"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

const TRIGGER_TYPES = [
  { value: "nft_minted", label: "NFT Minted", configFields: ["collection"] },
  { value: "token_transferred", label: "Token Transferred", configFields: ["token", "minAmount"] },
  { value: "defi_action", label: "DeFi Action", configFields: ["actionType"] },
  { value: "wallet_connected", label: "Wallet Connected", configFields: [] },
  { value: "segment_entered", label: "Segment Entered", configFields: ["segmentId"] },
  { value: "segment_exited", label: "Segment Exited", configFields: ["segmentId"] },
] as const;

export interface TriggerNodeData {
  triggerType: string;
  triggerConfig: Record<string, string>;
  isEnabled: boolean;
}

interface TriggerNodeEditorProps {
  value?: TriggerNodeData;
  onChange: (data: TriggerNodeData) => void;
  onRemove?: () => void;
}

export function TriggerNodeEditor({ value, onChange, onRemove }: TriggerNodeEditorProps) {
  const [triggerType, setTriggerType] = useState(value?.triggerType ?? "");
  const [config, setConfig] = useState<Record<string, string>>(value?.triggerConfig ?? {});
  const [isEnabled, setIsEnabled] = useState(value?.isEnabled ?? true);

  const selectedType = TRIGGER_TYPES.find((t) => t.value === triggerType);

  const handleTypeChange = (type: string) => {
    setTriggerType(type);
    setConfig({});
    onChange({ triggerType: type, triggerConfig: {}, isEnabled });
  };

  const handleConfigChange = (key: string, val: string) => {
    const updated = { ...config, [key]: val };
    setConfig(updated);
    onChange({ triggerType, triggerConfig: updated, isEnabled });
  };

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    onChange({ triggerType, triggerConfig: config, isEnabled: next });
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Event Trigger</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className={isEnabled ? "text-green-600" : "text-muted-foreground"}
            >
              {isEnabled ? "Enabled" : "Disabled"}
            </Button>
            {onRemove && (
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Trigger Type</Label>
          <Select value={triggerType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger type" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedType?.configFields.map((field) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
            <Input
              value={config[field] ?? ""}
              onChange={(e) => handleConfigChange(field, e.target.value)}
              placeholder={`Enter ${field}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface TriggerListEditorProps {
  triggers: TriggerNodeData[];
  onChange: (triggers: TriggerNodeData[]) => void;
}

export function TriggerListEditor({ triggers, onChange }: TriggerListEditorProps) {
  const handleAdd = () => {
    onChange([...triggers, { triggerType: "", triggerConfig: {}, isEnabled: true }]);
  };

  const handleUpdate = (index: number, data: TriggerNodeData) => {
    const updated = [...triggers];
    updated[index] = data;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(triggers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {triggers.map((trigger, i) => (
        <TriggerNodeEditor
          key={i}
          value={trigger}
          onChange={(data) => handleUpdate(i, data)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-2 h-3 w-3" />
        Add Trigger
      </Button>
    </div>
  );
}
