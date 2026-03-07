"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Eye, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";

interface PerStepStat {
  stepIndex: number;
  actionType: string;
  successCount: number;
  failCount: number;
}

interface CampaignStatsProps {
  sent?: number;
  opened?: number;
  converted?: number;
  totalEntries?: number;
  completedCount?: number;
  failedCount?: number;
  perStep?: PerStepStat[];
  conversionRate?: number;
}

const ACTION_LABELS: Record<string, string> = {
  send_telegram: "Send Telegram",
  send_discord: "Send Discord",
  airdrop_token: "Airdrop Token",
  grant_discord_role: "Grant Discord Role",
  issue_poap: "Issue POAP",
  ai_generate_content: "AI Content",
};

export function CampaignStats({
  sent,
  opened,
  converted,
  totalEntries,
  completedCount,
  failedCount,
  perStep,
  conversionRate,
}: CampaignStatsProps) {
  const openRate = sent && sent > 0 ? ((opened ?? 0) / sent * 100).toFixed(1) : "0";
  const legacyConvRate = sent && sent > 0 ? (((converted ?? 0) / sent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(totalEntries ?? sent ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(completedCount ?? converted ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(failedCount ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversionRate ?? legacyConvRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Step Funnel */}
      {perStep && perStep.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Per-Step Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {perStep.map((step) => {
              const total = step.successCount + step.failCount;
              const successPct = total > 0 ? (step.successCount / total) * 100 : 0;
              const failPct = total > 0 ? (step.failCount / total) * 100 : 0;

              return (
                <div key={step.stepIndex} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Step {step.stepIndex + 1}:{" "}
                      {ACTION_LABELS[step.actionType] || step.actionType}
                    </span>
                    <span className="text-muted-foreground">
                      {step.successCount}/{total}
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${successPct}%` }}
                      data-testid={`step-${step.stepIndex}-success-bar`}
                    />
                    <div
                      className="bg-red-400 transition-all"
                      style={{ width: `${failPct}%` }}
                      data-testid={`step-${step.stepIndex}-fail-bar`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Error Summary */}
      {perStep && perStep.some((s) => s.failCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-500">
              Error Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {perStep
                .filter((s) => s.failCount > 0)
                .map((s) => (
                  <li
                    key={s.stepIndex}
                    className="flex items-center justify-between"
                  >
                    <span>
                      Step {s.stepIndex + 1} (
                      {ACTION_LABELS[s.actionType] || s.actionType})
                    </span>
                    <span className="font-medium text-red-500">
                      {s.failCount} failure{s.failCount !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
