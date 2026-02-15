import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Eye, CheckCircle } from "lucide-react";

interface CampaignStatsProps {
  sent: number;
  opened: number;
  converted: number;
}

export function CampaignStats({ sent, opened, converted }: CampaignStatsProps) {
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : 0;
  const conversionRate = sent > 0 ? ((converted / sent) * 100).toFixed(1) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sent</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sent.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Opened</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{opened.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {openRate}% open rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Converted</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{converted.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {conversionRate}% conversion rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
