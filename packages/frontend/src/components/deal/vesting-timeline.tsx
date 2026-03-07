"use client";

import type { VestingSchedule } from "@/lib/hooks/use-escrow";
import { CheckCircle2, Circle } from "lucide-react";

interface VestingTimelineProps {
  vestingSchedule: VestingSchedule;
}

function elapsedPercent(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

export function VestingTimeline({ vestingSchedule }: VestingTimelineProps) {
  if (vestingSchedule.type === "LINEAR") {
    const pct = elapsedPercent(
      vestingSchedule.startDate,
      vestingSchedule.endDate
    );
    return (
      <div className="space-y-2" data-testid="vesting-linear">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Linear Vesting</span>
          <span className="font-medium">{pct}% elapsed</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{new Date(vestingSchedule.startDate).toLocaleDateString()}</span>
          <span>{new Date(vestingSchedule.endDate).toLocaleDateString()}</span>
        </div>
      </div>
    );
  }

  // MILESTONE
  const milestones = vestingSchedule.milestones ?? [];
  return (
    <div className="space-y-3" data-testid="vesting-milestones">
      <span className="text-sm text-muted-foreground">Milestone Vesting</span>
      <div className="space-y-2">
        {milestones.map((ms, i) => (
          <div key={i} className="flex items-start gap-3">
            {ms.completed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">{ms.description}</div>
              <div className="text-xs text-muted-foreground">
                {(ms.basisPoints / 100).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
