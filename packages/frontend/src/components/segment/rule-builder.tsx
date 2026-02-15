"use client";

import { useState } from "react";
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

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface RuleGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

const FIELDS = [
  { value: "tier", label: "Tier" },
  { value: "engagement_score", label: "Engagement Score" },
  { value: "tags", label: "Tags" },
  { value: "last_active_at", label: "Last Active" },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "contains", label: "Contains" },
];

export function RuleBuilder() {
  const [groups, setGroups] = useState<RuleGroup[]>([
    {
      id: "1",
      logic: "AND",
      conditions: [
        { id: "1-1", field: "", operator: "", value: "" },
      ],
    },
  ]);

  const addGroup = () => {
    setGroups([
      ...groups,
      {
        id: Date.now().toString(),
        logic: "AND",
        conditions: [{ id: `${Date.now()}-1`, field: "", operator: "", value: "" }],
      },
    ]);
  };

  const removeGroup = (groupId: string) => {
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const addCondition = (groupId: string) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: [
                ...group.conditions,
                {
                  id: `${groupId}-${Date.now()}`,
                  field: "",
                  operator: "",
                  value: "",
                },
              ],
            }
          : group
      )
    );
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.filter((c) => c.id !== conditionId),
            }
          : group
      )
    );
  };

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<Condition>
  ) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : group
      )
    );
  };

  const toggleGroupLogic = (groupId: string) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, logic: group.logic === "AND" ? "OR" : "AND" }
          : group
      )
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
            {group.conditions.map((condition, condIndex) => (
              <div key={condition.id} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) =>
                    updateCondition(group.id, condition.id, { field: value })
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(group.id, condition.id, { operator: value })
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(group.id, condition.id, {
                      value: e.target.value,
                    })
                  }
                  className="flex-1"
                />

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
            ))}

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
              : `${groups.length} rule group(s) defined`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
