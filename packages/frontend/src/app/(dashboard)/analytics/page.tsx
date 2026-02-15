"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

// Mock data
const retentionData = [
  { collection: "Sui Punks", week1: 85, week4: 72, week12: 58 },
  { collection: "Capy NFT", week1: 90, week4: 80, week12: 65 },
  { collection: "Bullshark", week1: 78, week4: 65, week12: 48 },
  { collection: "SuiFrens", week1: 92, week4: 85, week12: 72 },
];

const campaignConversion = [
  { campaign: "Welcome Series", sent: 1250, opened: 875, converted: 234 },
  { campaign: "Whale Engagement", sent: 450, opened: 380, converted: 125 },
  { campaign: "NFT Drop Alert", sent: 850, opened: 720, converted: 180 },
  { campaign: "Re-engagement", sent: 620, opened: 310, converted: 68 },
];

const engagementTrend = [
  { month: "Jan", avgScore: 42, activeUsers: 1200 },
  { month: "Feb", avgScore: 48, activeUsers: 1450 },
  { month: "Mar", avgScore: 52, activeUsers: 1680 },
  { month: "Apr", avgScore: 55, activeUsers: 1820 },
  { month: "May", avgScore: 58, activeUsers: 1950 },
  { month: "Jun", avgScore: 62, activeUsers: 2100 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Mixed on-chain and CRM analytics
        </p>
      </div>

      <Tabs defaultValue="retention" className="space-y-4">
        <TabsList>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Retention by NFT Holding</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={retentionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="collection" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="week1" fill="hsl(var(--chart-1))" name="Week 1" />
                  <Bar dataKey="week4" fill="hsl(var(--chart-2))" name="Week 4" />
                  <Bar dataKey="week12" fill="hsl(var(--chart-3))" name="Week 12" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Conversion Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={campaignConversion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="campaign" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill="hsl(var(--chart-1))" name="Sent" />
                  <Bar dataKey="opened" fill="hsl(var(--chart-2))" name="Opened" />
                  <Bar
                    dataKey="converted"
                    fill="hsl(var(--chart-3))"
                    name="Converted"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Trends Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgScore"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    name="Avg Engagement Score"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="activeUsers"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    name="Active Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
