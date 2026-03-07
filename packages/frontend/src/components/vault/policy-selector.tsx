"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface PolicyValue {
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
}

const RULE_OPTIONS = [
  { value: "0", label: "Workspace Members" },
  { value: "1", label: "Specific Addresses" },
  { value: "2", label: "Role-Based" },
] as const;

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
  return (
    <div className="space-y-3">
      <Label>Access Policy</Label>
      <div className="flex gap-2">
        {RULE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={String(value.ruleType) === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                ruleType: Number(opt.value) as 0 | 1 | 2,
              })
            }
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {value.ruleType === 1 && (
        <div className="space-y-1">
          <Label>Allowed Addresses</Label>
          <Input
            placeholder="0xaddr1, 0xaddr2, ..."
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
          <Label>Minimum Role</Label>
          <Select
            value={String(value.minRoleLevel ?? 1)}
            onValueChange={(v) =>
              onChange({ ...value, minRoleLevel: Number(v) })
            }
          >
            <SelectTrigger>
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
    </div>
  );
}
