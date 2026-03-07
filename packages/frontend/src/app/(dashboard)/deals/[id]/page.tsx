"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealDocuments } from "@/components/deal/deal-documents";
import { ArrowLeft, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  // Mock data
  const deal = {
    id: params.id,
    title: "Enterprise SaaS Deal",
    value: 50000,
    stage: "Qualified",
    profileName: "alice.sui",
    probability: 50,
    closeDate: "2026-03-15",
    description:
      "Partnership opportunity with enterprise client for Web3 CRM integration",
    workspaceId: "mock-workspace-id",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{deal.title}</h1>
          <p className="text-muted-foreground">Deal #{deal.id}</p>
        </div>
        <Badge>{deal.stage}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${deal.value.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Close Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(deal.closeDate).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deal.probability}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{deal.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{deal.profileName}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DealDocuments
            dealId={deal.id}
            workspaceId={deal.workspaceId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
