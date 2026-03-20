"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface PolicyValue {
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
  expiresAtMs?: number;
}

const ROLES = [
  { value: "0", label: "Viewer" },
  { value: "1", label: "Member" },
  { value: "2", label: "Admin" },
  { value: "3", label: "Owner" },
] as const;

export function PolicySelector({
  value,
  onChange,
}: {
  value: PolicyValue;
  onChange: (v: PolicyValue) => void;
}) {
  const [expanded, setExpanded] = useState(value.ruleType !== 0);

  const handleModeChange = (mode: string) => {
    if (mode === "workspace") {
      setExpanded(false);
      onChange({ ruleType: 0 });
    } else {
      setExpanded(true);
      if (value.ruleType === 0) {
        onChange({ ...value, ruleType: 1 });
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label>Access Policy</Label>
      <RadioGroup
        value={expanded ? "custom" : "workspace"}
        onValueChange={handleModeChange}
        className="space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="workspace" id="policy-workspace" />
          <Label htmlFor="policy-workspace" className="font-normal cursor-pointer">
            Workspace Members
            <span className="text-xs text-muted-foreground ml-1">(all members can decrypt)</span>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="policy-custom" />
          <Label htmlFor="policy-custom" className="font-normal cursor-pointer flex items-center gap-1">
            Custom
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Label>
        </div>
      </RadioGroup>

      {expanded && (
        <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
          <div className="space-y-1">
            <Label className="text-xs">Rule Type</Label>
            <Select
              value={String(value.ruleType)}
              onValueChange={(v) =>
                onChange({ ...value, ruleType: Number(v) as 1 | 2 })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Specific Addresses</SelectItem>
                <SelectItem value="2">Role-Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.ruleType === 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Allowed Addresses</Label>
              <Input
                placeholder="0xaddr1, 0xaddr2, ..."
                className="h-8 text-sm"
                value={value.allowedAddresses?.join(", ") ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    allowedAddresses: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          )}

          {value.ruleType === 2 && (
            <div className="space-y-1">
              <Label className="text-xs">Minimum Role</Label>
              <Select
                value={String(value.minRoleLevel ?? 1)}
                onValueChange={(v) =>
                  onChange({ ...value, minRoleLevel: Number(v) })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">
              Policy Expiry{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              type="datetime-local"
              className="h-8 text-sm"
              value={
                value.expiresAtMs
                  ? new Date(value.expiresAtMs).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  expiresAtMs: e.target.value
                    ? new Date(e.target.value).getTime()
                    : undefined,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
