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
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealCard } from "./deal-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Deal {
  id: string;
  title: string;
  value?: number;
  stage: string;
  profileName?: string;
  probability?: number;
}

interface KanbanBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, newStage: string) => void;
}

const STAGES = ["New", "Qualified", "Proposal", "Won", "Lost"];

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

  const getDealsByStage = (stage: string) =>
    deals.filter((deal) => deal.stage === stage);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const stageDeals = getDealsByStage(stage);
          return (
            <Card key={stage}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {stage}
                  <span className="ml-2 text-muted-foreground">
                    ({stageDeals.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <SortableContext
                    id={stage}
                    items={stageDeals.map((d) => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {stageDeals.map((deal) => (
                        <div key={deal.id}>
                          <DealCard {...deal} />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard {...activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
