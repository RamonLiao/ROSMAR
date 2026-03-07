"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EscrowData, EscrowState } from "@/lib/hooks/use-escrow";
import { VestingTimeline } from "./vesting-timeline";
import {
  FundDialog,
  ReleaseDialog,
  DisputeDialog,
  VoteDialog,
} from "./escrow-actions";

// ── Helpers ────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const STATE_BADGE_VARIANT: Record<
  EscrowState,
  "outline" | "default" | "secondary" | "destructive"
> = {
  CREATED: "outline",
  FUNDED: "default",
  COMPLETED: "secondary",
  DISPUTED: "destructive",
  REFUNDED: "secondary",
};

// ── Component ──────────────────────────────────────────

export interface EscrowPanelProps {
  escrow: EscrowData;
  currentUserAddress?: string;
  onAction?: (action: string, data?: unknown) => void;
}

export function EscrowPanel({
  escrow,
  currentUserAddress,
  onAction,
}: EscrowPanelProps) {
  const total = Number(escrow.totalAmount);
  const released = Number(escrow.releasedAmount);
  const progressPct = total > 0 ? Math.round((released / total) * 100) : 0;

  const isPayer =
    currentUserAddress?.toLowerCase() === escrow.payer.toLowerCase();
  const isArbiter = escrow.arbitrators.some(
    (a) => a.address.toLowerCase() === currentUserAddress?.toLowerCase()
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Escrow</CardTitle>
        <Badge variant={STATE_BADGE_VARIANT[escrow.state]}>{escrow.state}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Released / Total</span>
            <span className="font-medium">
              {released.toLocaleString()} / {total.toLocaleString()}{" "}
              {escrow.tokenType}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Fund progress"
            />
          </div>
        </div>

        {/* Addresses */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Payer</div>
            <div className="text-sm font-mono" title={escrow.payer}>
              {truncateAddress(escrow.payer)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Payee</div>
            <div className="text-sm font-mono" title={escrow.payee}>
              {truncateAddress(escrow.payee)}
            </div>
          </div>
        </div>

        {/* Arbitrators */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Arbitrators ({escrow.arbiterThreshold} required)
          </div>
          <div className="flex flex-wrap gap-1">
            {escrow.arbitrators.map((a) => (
              <Badge key={a.address} variant="outline" className="font-mono text-xs">
                {truncateAddress(a.address)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Vesting */}
        {escrow.vestingSchedule && (
          <VestingTimeline vestingSchedule={escrow.vestingSchedule} />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {escrow.state === "CREATED" && isPayer && (
            <FundDialog
              onConfirm={(amount) => onAction?.("fund", { amount })}
            />
          )}
          {escrow.state === "FUNDED" && isPayer && (
            <>
              <ReleaseDialog
                totalAmount={escrow.totalAmount}
                releasedAmount={escrow.releasedAmount}
                onConfirm={(amount) => onAction?.("release", { amount })}
              />
              <DisputeDialog
                onConfirm={(reason) => onAction?.("dispute", { reason })}
              />
            </>
          )}
          {escrow.state === "DISPUTED" && isArbiter && (
            <VoteDialog
              onConfirm={(vote) => onAction?.("vote", { vote })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
