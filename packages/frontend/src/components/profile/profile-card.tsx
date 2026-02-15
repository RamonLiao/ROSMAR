import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddressDisplay } from "@/components/shared/address-display";
import { TierBadge } from "@/components/shared/tier-badge";
import { EngagementBadge } from "./engagement-badge";

interface ProfileCardProps {
  address: string;
  suinsName?: string;
  tier: number;
  score: number;
  avatarUrl?: string;
}

export function ProfileCard({
  address,
  suinsName,
  tier,
  score,
  avatarUrl,
}: ProfileCardProps) {
  const initials = suinsName
    ? suinsName.slice(0, 2).toUpperCase()
    : address.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl ? (
              <img src={avatarUrl} alt={suinsName || address} />
            ) : (
              <AvatarFallback>{initials}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {suinsName || "Unknown"}
            </h3>
            <AddressDisplay address={address} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Tier</div>
            <TierBadge tier={tier} className="mt-1" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Engagement</div>
            <EngagementBadge score={score} trend="up" className="mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
