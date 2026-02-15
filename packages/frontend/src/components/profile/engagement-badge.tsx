import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EngagementBadgeProps {
  score: number;
  trend?: "up" | "down" | "stable";
  className?: string;
}

export function EngagementBadge({ score, trend, className }: EngagementBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500 text-white";
    if (score >= 60) return "bg-blue-500 text-white";
    if (score >= 40) return "bg-yellow-500 text-white";
    if (score >= 20) return "bg-orange-500 text-white";
    return "bg-red-500 text-white";
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge className={getScoreColor(score)}>
        {score}
      </Badge>
      {trend && <TrendIcon className="h-3 w-3 text-muted-foreground" />}
    </div>
  );
}
