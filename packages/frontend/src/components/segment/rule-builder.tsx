"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useDiscordRoles } from "@/hooks/use-discord-roles";

export interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface RuleGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

export interface SegmentRules {
  groups: RuleGroup[];
}

// ─── Field-aware configuration ───────────────────

interface FieldConfig {
  value: string;
  label: string;
  category: "profile" | "on-chain" | "social";
  operators: { value: string; label: string }[];
  valueType: "text" | "number" | "token-amount" | "discord-role";
}

const FIELD_CONFIG: FieldConfig[] = [
  {
    value: "tier",
    label: "Tier",
    category: "profile",
    operators: [
      { value: "equals", label: "Equals" },
      { value: "gt", label: "Greater Than" },
      { value: "gte", label: "Greater Than or Equal" },
      { value: "lt", label: "Less Than" },
      { value: "lte", label: "Less Than or Equal" },
    ],
    valueType: "number",
  },
  {
    value: "engagement_score",
    label: "Engagement Score",
    category: "profile",
    operators: [
      { value: "equals", label: "Equals" },
      { value: "gt", label: "Greater Than" },
      { value: "gte", label: "Greater Than or Equal" },
      { value: "lt", label: "Less Than" },
      { value: "lte", label: "Less Than or Equal" },
    ],
    valueType: "number",
  },
  {
    value: "tags",
    label: "Tags",
    category: "profile",
    operators: [{ value: "contains", label: "Contains" }],
    valueType: "text",
  },
  {
    value: "wallet_chain",
    label: "Wallet Chain",
    category: "on-chain",
    operators: [{ value: "equals", label: "Equals" }],
    valueType: "text",
  },
  {
    value: "created_after",
    label: "Created After",
    category: "profile",
    operators: [{ value: "gte", label: "On or After" }],
    valueType: "text",
  },
  {
    value: "nft_collection",
    label: "NFT Collection",
    category: "on-chain",
    operators: [
      { value: "holds", label: "Holds" },
      { value: "not_holds", label: "Does Not Hold" },
    ],
    valueType: "text",
  },
  {
    value: "token_balance",
    label: "Token Balance",
    category: "on-chain",
    operators: [
      { value: "gt", label: "Greater Than" },
      { value: "gte", label: "Greater Than or Equal" },
      { value: "lt", label: "Less Than" },
      { value: "lte", label: "Less Than or Equal" },
    ],
    valueType: "token-amount",
  },
  {
    value: "discord_role",
    label: "Discord Role",
    category: "social",
    operators: [
      { value: "has_role", label: "Has Role" },
      { value: "not_has_role", label: "Does Not Have Role" },
    ],
    valueType: "discord-role",
  },
];

interface RuleBuilderProps {
  value: RuleGroup[];
  onChange: (groups: RuleGroup[]) => void;
  workspaceId?: string;
}

export function RuleBuilder({ value: groups, onChange, workspaceId }: RuleBuilderProps) {
  const { roles: discordRoles } = useDiscordRoles(workspaceId);

  const fieldMap = useMemo(
    () => new Map(FIELD_CONFIG.map((f) => [f.value, f])),
    [],
  );

  const update = useCallback(
    (fn: (prev: RuleGroup[]) => RuleGroup[]) => onChange(fn(groups)),
    [groups, onChange],
  );

  const addGroup = () => {
    update((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        logic: "AND" as const,
        conditions: [{ id: `${Date.now()}-1`, field: "", operator: "", value: "" }],
      },
    ]);
  };

  const removeGroup = (groupId: string) => {
    update((prev) => prev.filter((g) => g.id !== groupId));
  };

  const addCondition = (groupId: string) => {
    update((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: [
                ...group.conditions,
                { id: `${groupId}-${Date.now()}`, field: "", operator: "", value: "" },
              ],
            }
          : group,
      ),
    );
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    update((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, conditions: group.conditions.filter((c) => c.id !== conditionId) }
          : group,
      ),
    );
  };

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<Condition>,
  ) => {
    update((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c,
              ),
            }
          : group,
      ),
    );
  };

  const toggleGroupLogic = (groupId: string) => {
    update((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, logic: group.logic === "AND" ? "OR" : "AND" }
          : group,
      ),
    );
  };

  const renderValueInput = (
    group: RuleGroup,
    condition: Condition,
    fieldConfig: FieldConfig | undefined,
  ) => {
    if (fieldConfig?.valueType === "token-amount") {
      const parsed = (() => {
        try {
          return JSON.parse(condition.value || "{}");
        } catch {
          return {};
        }
      })();
      return (
        <div className="flex flex-1 items-center gap-1">
          <Input
            placeholder="Token (e.g., SUI)"
            value={parsed.token ?? ""}
            onChange={(e) =>
              updateCondition(group.id, condition.id, {
                value: JSON.stringify({ ...parsed, token: e.target.value }),
              })
            }
            className="w-[120px]"
          />
          <Input
            type="number"
            placeholder="Amount"
            value={parsed.amount ?? ""}
            onChange={(e) =>
              updateCondition(group.id, condition.id, {
                value: JSON.stringify({ ...parsed, amount: e.target.value }),
              })
            }
            className="flex-1"
          />
        </div>
      );
    }

    if (fieldConfig?.valueType === "discord-role") {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => updateCondition(group.id, condition.id, { value: v })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {discordRoles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        placeholder="Value"
        type={fieldConfig?.valueType === "number" ? "number" : "text"}
        value={condition.value}
        onChange={(e) =>
          updateCondition(group.id, condition.id, { value: e.target.value })
        }
        className="flex-1"
      />
    );
  };

  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <Card key={group.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium">
              Group {groupIndex + 1}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={group.logic === "AND" ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => toggleGroupLogic(group.id)}
              >
                {group.logic}
              </Badge>
              {groups.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroup(group.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.conditions.map((condition) => {
              const fieldConfig = fieldMap.get(condition.field);
              const operators = fieldConfig?.operators ?? [];

              return (
                <div key={condition.id} className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(v) => {
                      // Reset operator and value when field changes
                      updateCondition(group.id, condition.id, {
                        field: v,
                        operator: "",
                        value: "",
                      });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_CONFIG.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(v) =>
                      updateCondition(group.id, condition.id, { operator: v })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {renderValueInput(group, condition, fieldConfig)}

                  {group.conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(group.id, condition.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => addCondition(group.id)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addGroup}>
        <Plus className="mr-2 h-4 w-4" />
        Add Group
      </Button>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {groups.length === 0
              ? "No rules defined"
              : `${groups.length} rule group(s) with ${groups.reduce((sum, g) => sum + g.conditions.filter((c) => c.field && c.operator).length, 0)} active condition(s)`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Check if rules JSON has any meaningful content */
export function hasRules(rules: unknown): boolean {
  if (!rules || typeof rules !== "object") return false;
  const r = rules as { groups?: unknown[] };
  return Array.isArray(r.groups) && r.groups.length > 0;
}

/** Default empty rule group for new segments */
export function defaultRuleGroups(): RuleGroup[] {
  return [
    {
      id: "1",
      logic: "AND",
      conditions: [{ id: "1-1", field: "", operator: "", value: "" }],
    },
  ];
}
