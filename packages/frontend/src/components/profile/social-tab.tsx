"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useSocialLinks,
  useLinkSocial,
  useUnlinkSocial,
  SocialLink,
} from "@/lib/hooks/use-social-links";
import { Loader2, CheckCircle2, Link2, Unlink } from "lucide-react";

const PLATFORMS = [
  { key: "discord", label: "Discord", icon: "🎮", linkable: true },
  { key: "telegram", label: "Telegram", icon: "✈️", linkable: false },
  { key: "x", label: "X (Twitter)", icon: "𝕏", linkable: true },
  { key: "apple", label: "Apple", icon: "🍎", linkable: false },
] as const;

interface SocialTabProps {
  profileId: string;
}

export function SocialTab({ profileId }: SocialTabProps) {
  const { data: links, isLoading } = useSocialLinks(profileId);
  const unlinkMutation = useUnlinkSocial();
  const linkDiscord = useLinkSocial("discord");
  const linkX = useLinkSocial("x");

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const linkMap = new Map<string, SocialLink>();
  links?.forEach((l) => linkMap.set(l.platform, l));

  const handleLink = (platform: string) => {
    if (platform === "discord") linkDiscord.mutate(profileId);
    if (platform === "x") linkX.mutate(profileId);
  };

  const handleUnlink = (platform: string) => {
    unlinkMutation.mutate({ profileId, platform });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLATFORMS.map(({ key, label, icon, linkable }) => {
        const link = linkMap.get(key);
        return (
          <Card key={key} data-testid={`social-card-${key}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{icon}</span>
                  {label}
                </CardTitle>
                {link?.verified && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {link ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Linked as
                    </div>
                    <div className="font-medium">
                      {link.platformUsername || link.platformUserId}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnlink(key)}
                    disabled={unlinkMutation.isPending}
                  >
                    {unlinkMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 h-4 w-4" />
                    )}
                    Unlink
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Not linked</p>
                  {linkable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLink(key)}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Link {label}
                    </Button>
                  ) : key === "telegram" ? (
                    <p className="text-xs text-muted-foreground">
                      Use the Telegram Login Widget to link
                    </p>
                  ) : key === "apple" ? (
                    <p className="text-xs text-muted-foreground">
                      Linked automatically via ZkLogin
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
