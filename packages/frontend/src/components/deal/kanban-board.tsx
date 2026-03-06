"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealCard } from "./deal-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEAL_STAGES } from "@/lib/constants";

interface Deal {
  id: string;
  title: string;
  value?: number;
  stage: string;
  profileName?: string;
  probability?: number;
  notes?: string | null;
}

interface KanbanBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, newStage: string) => void;
}

// Use shared stage constants — value for DB matching, label for display

export function KanbanBoard({ deals, onStageChange }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const dealId = active.id as string;
      const newStage = over.id as string;
      onStageChange(dealId, newStage);
    }

    setActiveDeal(null);
  };

  const getDealsByStage = (stageValue: string) =>
    deals.filter((deal) => deal.stage === stageValue);

  // Custom Kanban Column component to make empty columns droppable
  const KanbanColumn = ({ stage, stageDeals }: { stage: any, stageDeals: Deal[] }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: stage.value,
    });

    return (
      <Card
        ref={setNodeRef}
        className={`flex h-full flex-col min-h-[500px] rounded-xl border border-border bg-slate-100/80 dark:bg-white/[0.04] shadow-none hover:translate-y-0 hover:shadow-none transition-colors ${
          isOver ? "bg-slate-200/80 dark:bg-white/[0.08] ring-2 ring-primary/30" : ""
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="tracking-tight">{stage.label}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-muted text-xs font-semibold text-muted-foreground">
              {stageDeals.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] w-full pr-4">
            <SortableContext
              id={stage.value}
              items={stageDeals.map((d) => d.id)}
              strategy={rectSortingStrategy}
            >
              <div className="flex h-full flex-col gap-3 p-1 pb-8">
                {stageDeals.map((deal) => (
                  <div key={deal.id} className="hover:shadow-sm hover:border-primary/10 transition-all duration-150 rounded-xl">
                    <DealCard {...deal} />
                  </div>
                ))}
                {/* Empty placeholder to ensure column remains droppable even when empty */}
                {stageDeals.length === 0 && (
                  <div className="flex-1 rounded-md border-2 border-dashed border-border/40 min-h-[100px]" />
                )}
              </div>
            </SortableContext>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid h-full grid-cols-1 gap-6 md:flex md:overflow-x-auto md:pb-4">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = getDealsByStage(stage.value);
          return (
            <div key={stage.value} className="min-w-[320px] flex-shrink-0 w-full md:w-[320px]">
              <KanbanColumn stage={stage} stageDeals={stageDeals} />
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard {...activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
