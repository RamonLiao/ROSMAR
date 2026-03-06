"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreDistribution } from "@/components/charts/score-distribution";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { PipelineFunnel } from "@/components/charts/pipeline-funnel";
import { Users, Wallet, TrendingUp, Ticket, Loader2 } from "lucide-react";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { useScoreDistribution, useActivityHeatmap, usePipelineSummary } from "@/lib/hooks/use-analytics";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: scoreData } = useScoreDistribution();
  const { data: activityData } = useActivityHeatmap();
  const { data: pipelineData } = usePipelineSummary();

  return (
    <div className="space-y-6 relative overflow-hidden p-2 -m-2">
      {/* Brand Identity: The Digital Anchor & Matte/Crystalline animated background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#2DD4BF]/5 dark:bg-[#2DD4BF]/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#E2E8F0]/30 dark:bg-[#E2E8F0]/8 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.03)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06)_0%,transparent_60%)]" />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1 tracking-tight">
          Welcome to ROSMAR CRM
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium tracking-tight text-muted-foreground">
              Total Profiles
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                (stats?.profileCount ?? 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium tracking-tight text-muted-foreground">
              Active Deals
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                (stats?.dealCount ?? 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium tracking-tight text-muted-foreground">
              Pipeline Total
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                formatCurrency(stats?.pipelineTotal ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium tracking-tight text-muted-foreground">
              Segments
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

        <TabsContent value="engagement" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="tracking-tight">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistribution data={scoreData ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="tracking-tight">Activity Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap data={activityData ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="tracking-tight">Deal Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineFunnel data={(pipelineData ?? []).length > 0 ? pipelineData ?? [] : [{ stage: "No deals", count: 0, value: 0 }]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
