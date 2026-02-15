"use client";

import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/deal/kanban-board";
import { Plus, Loader2 } from "lucide-react";
import { useDeals, useUpdateDealStage } from "@/lib/hooks/use-deals";

export default function DealsPage() {
  const { data, isLoading, error } = useDeals();
  const updateStage = useUpdateDealStage();

  const deals = (data?.deals ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    value: Number(d.amountUsd),
    stage: d.stage,
    profileName: d.profileId,
    probability: 0,
  }));

  const handleStageChange = (dealId: string, newStage: string) => {
    const deal = data?.deals.find((d) => d.id === dealId);
    if (!deal) return;
    updateStage.mutate({ id: dealId, stage: newStage, expectedVersion: deal.version });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-muted-foreground">
            Drag and drop deals to update stages
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Deal
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load deals: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <KanbanBoard deals={deals} onStageChange={handleStageChange} />
      )}
    </div>
  );
}
