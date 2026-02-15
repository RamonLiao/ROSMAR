import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: number;
  className?: string;
}

const tierConfig = {
  0: { label: "Bronze", color: "bg-amber-700 text-white" },
  1: { label: "Silver", color: "bg-gray-400 text-white" },
  2: { label: "Gold", color: "bg-yellow-500 text-white" },
  3: { label: "Platinum", color: "bg-blue-500 text-white" },
  4: { label: "Diamond", color: "bg-purple-600 text-white" },
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig[0];

  return (
    <Badge className={cn(config.color, className)}>
      {config.label}
    </Badge>
  );
}
