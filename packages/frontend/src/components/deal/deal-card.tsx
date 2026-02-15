import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface DealCardProps {
  id: string;
  title: string;
  value?: number;
  stage: string;
  profileName?: string;
  probability?: number;
}

export function DealCard({
  title,
  value,
  stage,
  profileName,
  probability,
}: DealCardProps) {
  return (
    <Card className="cursor-move">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <h4 className="font-semibold">{title}</h4>
          <Badge variant="secondary">{stage}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {value && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium">
              ${value.toLocaleString()}
            </span>
          </div>
        )}
        {profileName && (
          <p className="text-sm text-muted-foreground">{profileName}</p>
        )}
        {probability !== undefined && (
          <div className="text-sm">
            <span className="text-muted-foreground">Probability: </span>
            <span className="font-medium">{probability}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
