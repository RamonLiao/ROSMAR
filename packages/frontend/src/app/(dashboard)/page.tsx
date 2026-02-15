"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreDistribution } from "@/components/charts/score-distribution";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { PipelineFunnel } from "@/components/charts/pipeline-funnel";
import { Users, Wallet, TrendingUp, Ticket, Loader2 } from "lucide-react";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { useDeals } from "@/lib/hooks/use-deals";
import { useScoreDistribution, useActivityHeatmap } from "@/lib/hooks/use-analytics";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: dealsData } = useDeals({ limit: 100 });
  const { data: scoreData } = useScoreDistribution();
  const { data: activityData } = useActivityHeatmap();

  // Build pipeline data from real deals
  const pipelineData = (() => {
    const deals = dealsData?.deals ?? [];
    const stageMap = new Map<string, { count: number; value: number }>();
    for (const deal of deals) {
      const entry = stageMap.get(deal.stage) ?? { count: 0, value: 0 };
      entry.count++;
      entry.value += Number(deal.amountUsd);
      stageMap.set(deal.stage, entry);
    }
    return Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
    }));
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to ROSMAR CRM
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Profiles
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                (stats?.profileCount ?? 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Deals
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                (stats?.dealCount ?? 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pipeline Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                formatCurrency(stats?.pipelineTotal ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Segments
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                (stats?.segmentCount ?? 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistribution data={scoreData ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap data={activityData ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deal Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineFunnel data={pipelineData.length > 0 ? pipelineData : [{ stage: "No deals", count: 0, value: 0 }]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
