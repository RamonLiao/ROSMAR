"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SaftTemplate } from "@/lib/hooks/use-escrow";
import { Plus } from "lucide-react";

interface SaftTemplatePickerProps {
  templates: SaftTemplate[];
  onSelect: (template: SaftTemplate) => void;
  onCreate: () => void;
}

export function SaftTemplatePicker({
  templates,
  onSelect,
  onCreate,
}: SaftTemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (template: SaftTemplate) => {
    setSelectedId(template.id);
    onSelect(template);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">SAFT Templates</h3>
      <div className="space-y-2">
        {templates.map((t) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-colors ${
              selectedId === t.id
                ? "border-primary ring-1 ring-primary"
                : "hover:border-muted-foreground/30"
            }`}
            onClick={() => handleSelect(t)}
          >
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="saft-template"
                  checked={selectedId === t.id}
                  onChange={() => handleSelect(t)}
                  className="shrink-0"
                />
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.tokenSymbol} &middot; {t.totalTokens.toLocaleString()}{" "}
                    tokens &middot; {t.vestingMonths}mo vesting
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create New
        </Button>
      </div>
    </div>
  );
}
