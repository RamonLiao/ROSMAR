"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { KanbanBoard } from "@/components/deal/kanban-board";
import { LayoutGrid, List, Loader2, Search } from "lucide-react";
import { useDeals, useUpdateDealStage } from "@/lib/hooks/use-deals";
import { CreateDealDialog } from "@/components/deal/create-deal-dialog";
import { useState, useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEAL_STAGES } from "@/lib/constants";
import { useRouter } from "next/navigation";

type ViewMode = "kanban" | "list";

export default function DealsPage() {
  const { data, isLoading, error } = useDeals();
  const updateStage = useUpdateDealStage();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const deals = (data?.deals ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    value: Number(d.amountUsd),
    stage: d.stage,
    profileName: d.profileId,
    probability: 0,
    notes: d.notes,
  }));

  const defaultView: ViewMode = deals.length > 20 ? "list" : "kanban";
  const [view, setView] = useState<ViewMode>(defaultView);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const q = searchQuery.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q));
  }, [deals, searchQuery]);

  const handleStageChange = (dealId: string, newStage: string) => {
    const deal = data?.deals.find((d) => d.id === dealId);
    if (!deal) return;
    updateStage.mutate({ id: dealId, stage: newStage, expectedVersion: deal.version });
  };

  const stageLabel = (value: string) =>
    DEAL_STAGES.find((s) => s.value === value)?.label ?? value;

  const listColumns = [
    {
      key: "title",
      label: "Title",
      render: (item: (typeof filteredDeals)[0]) => (
        <button
          className="text-left font-medium hover:underline text-foreground"
          onClick={() => router.push(`/deals/${item.id}`)}
        >
          {item.title}
        </button>
      ),
    },
    {
      key: "value",
      label: "Amount (USD)",
      render: (item: (typeof filteredDeals)[0]) =>
        `$${item.value.toLocaleString()}`,
    },
    {
      key: "stage",
      label: "Stage",
      render: (item: (typeof filteredDeals)[0]) => stageLabel(item.stage),
    },
    {
      key: "profileName",
      label: "Profile",
    },
  ];

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={staggerItem} className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Deals Pipeline</h1>
          <p className="text-muted-foreground tracking-tight">
            {view === "kanban"
              ? "Drag and drop deals to update stages"
              : "Browse and search all deals"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-52"
            />
          </div>

          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setView("kanban")}
              aria-label="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <CreateDealDialog />
        </div>
      </motion.div>

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

      {!isLoading && !error && view === "kanban" && (
        <motion.div variants={staggerItem}>
          <KanbanBoard deals={filteredDeals} onStageChange={handleStageChange} />
        </motion.div>
      )}

      {!isLoading && !error && view === "list" && (
        <motion.div variants={staggerItem}>
          <DataTable
            data={filteredDeals.map((d) => ({ ...d } as Record<string, unknown>))}
            columns={listColumns as Parameters<typeof DataTable>[0]["columns"]}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
