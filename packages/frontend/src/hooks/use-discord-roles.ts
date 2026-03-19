"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";

interface DiscordRole {
  id: string;
  name: string;
}

interface DiscordRolesResponse {
  guildId: string | null;
  roles: DiscordRole[];
}

export function useDiscordRoles(workspaceId: string | undefined) {
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    // Use queueMicrotask to avoid React compiler "sync setState in effect" warning
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });

    apiClient
      .get<DiscordRolesResponse>(`/workspaces/${workspaceId}/discord-roles`)
      .then((data) => {
        if (cancelled) return;
        setRoles(data.roles);
        setGuildId(data.guildId);
      })
      .catch(() => {
        if (cancelled) return;
        setRoles([]);
        setGuildId(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { roles, guildId, isLoading };
}
