"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreDistribution } from "@/components/charts/score-distribution";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { PipelineFunnel } from "@/components/charts/pipeline-funnel";
import {
  useScoreDistribution,
  useActivityHeatmap,
  usePipelineSummary,
} from "@/lib/hooks/use-analytics";
import { Loader2, AlertCircle } from "lucide-react";

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ChartError({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground">
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm">{message ?? "Failed to load data"}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const {
    data: scoreData,
    isLoading: scoreLoading,
    error: scoreError,
  } = useScoreDistribution();
  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
  } = useActivityHeatmap();
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    error: pipelineError,
  } = usePipelineSummary();

  // Derived stats from pipeline data
  const totalDeals = pipelineData?.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const totalValue = pipelineData?.reduce((sum, s) => sum + s.value, 0) ?? 0;
  const totalProfiles = scoreData?.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const avgScore =
    totalProfiles > 0
      ? Math.round(
          (scoreData ?? []).reduce((sum, b) => {
            // Estimate midpoint of each range for weighted avg
            const mid = { "0-20": 10, "21-40": 30, "41-60": 50, "61-80": 70, "81-100": 90 }[b.range] ?? 50;
            return sum + mid * b.count;
          }, 0) / totalProfiles
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground tracking-tight">
          CRM engagement, activity, and pipeline insights
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {scoreLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                totalProfiles.toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Engagement Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {scoreLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                avgScore
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {pipelineLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  {formatCurrency(totalValue)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({totalDeals} deals)
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="tracking-tight">
            Engagement Score Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Profile distribution across engagement score ranges
          </p>
        </CardHeader>
        <CardContent>
          {scoreLoading ? (
            <ChartLoader />
          ) : scoreError ? (
            <ChartError />
          ) : (
            <ScoreDistribution data={scoreData ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="tracking-tight">Activity Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">
            Profile and deal creation activity by day and hour
          </p>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <ChartLoader />
          ) : activityError ? (
            <ChartError />
          ) : (
            <ActivityHeatmap data={activityData ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="tracking-tight">Deal Pipeline</CardTitle>
          <p className="text-sm text-muted-foreground">
            Deal count by stage
          </p>
        </CardHeader>
        <CardContent>
          {pipelineLoading ? (
            <ChartLoader />
          ) : pipelineError ? (
            <ChartError />
          ) : (
            <PipelineFunnel
              data={
                (pipelineData ?? []).length > 0
                  ? pipelineData ?? []
                  : [{ stage: "No deals", count: 0, value: 0 }]
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
