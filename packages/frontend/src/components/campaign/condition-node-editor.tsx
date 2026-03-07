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

const CONDITION_FIELDS = [
  { value: "engagement_score", label: "Engagement Score", type: "number" },
  { value: "tier", label: "Tier", type: "number" },
  { value: "balance", label: "Balance (SUI)", type: "number" },
  { value: "tag", label: "Has Tag", type: "string" },
  { value: "nft_count", label: "NFT Count", type: "number" },
] as const;

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "contains", label: "contains" },
] as const;

export interface ConditionNodeData {
  field: string;
  operator: string;
  value: string;
}

interface ConditionNodeEditorProps {
  value?: ConditionNodeData;
  onChange: (data: ConditionNodeData) => void;
  onRemove?: () => void;
}

export function ConditionNodeEditor({ value, onChange, onRemove }: ConditionNodeEditorProps) {
  const [field, setField] = useState(value?.field ?? "");
  const [operator, setOperator] = useState(value?.operator ?? "gt");
  const [condValue, setCondValue] = useState(value?.value ?? "");

  const handleFieldChange = (f: string) => {
    setField(f);
    onChange({ field: f, operator, value: condValue });
  };

  const handleOperatorChange = (op: string) => {
    setOperator(op);
    onChange({ field, operator: op, value: condValue });
  };

  const handleValueChange = (v: string) => {
    setCondValue(v);
    onChange({ field, operator, value: v });
  };

  return (
    <Card className="border-dashed border-amber-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Condition</CardTitle>
          {onRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Select value={field} onValueChange={handleFieldChange}>
              <SelectTrigger>
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Operator</Label>
            <Select value={operator} onValueChange={handleOperatorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Op" />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              value={condValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="Value"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConditionListEditorProps {
  conditions: ConditionNodeData[];
  onChange: (conditions: ConditionNodeData[]) => void;
}

export function ConditionListEditor({ conditions, onChange }: ConditionListEditorProps) {
  const handleAdd = () => {
    onChange([...conditions, { field: "", operator: "gt", value: "" }]);
  };

  const handleUpdate = (index: number, data: ConditionNodeData) => {
    const updated = [...conditions];
    updated[index] = data;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {conditions.map((cond, i) => (
        <ConditionNodeEditor
          key={i}
          value={cond}
          onChange={(data) => handleUpdate(i, data)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-2 h-3 w-3" />
        Add Condition
      </Button>
    </div>
  );
}
