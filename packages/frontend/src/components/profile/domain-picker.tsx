"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Domain {
  domain: string;
  chain: string;
  source: string;
}

const CHAIN_LABELS: Record<string, string> = {
  sui: "SUI",
  evm: "ETH",
  solana: "SOL",
};

const CHAIN_COLORS: Record<string, string> = {
  sui: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  evm: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  solana: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function useProfileDomains(profileId: string) {
  return useQuery({
    queryKey: ["profile-domains", profileId],
    queryFn: () =>
      apiClient
        .get<{ domains: Domain[] }>(`/profiles/${profileId}/domains`)
        .then((r) => r.domains),
    enabled: !!profileId,
  });
}

function useSetPrimaryDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      domain,
    }: {
      profileId: string;
      domain: string;
    }) => apiClient.put(`/profiles/${profileId}/primary-domain`, { domain }),
    onSuccess: (_, { profileId }) => {
      qc.invalidateQueries({ queryKey: ["profile", profileId] });
      qc.invalidateQueries({ queryKey: ["profile-domains", profileId] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

interface DomainPickerProps {
  profileId: string;
  currentDomain?: string;
}

export function DomainPicker({ profileId, currentDomain }: DomainPickerProps) {
  const { data: domains, isLoading } = useProfileDomains(profileId);
  const setPrimary = useSetPrimaryDomain();

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!domains || domains.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No domains linked</span>
    );
  }

  // Single domain — no picker needed
  if (domains.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{domains[0].domain}</span>
        <Badge
          variant="secondary"
          className={`text-xs ${CHAIN_COLORS[domains[0].chain] ?? ""}`}
        >
          {CHAIN_LABELS[domains[0].chain] ?? domains[0].chain.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentDomain ?? ""}
        onValueChange={(value) => {
          setPrimary.mutate({ profileId, domain: value });
        }}
      >
        <SelectTrigger size="sm" className="w-auto min-w-[160px]">
          <SelectValue placeholder="Select primary domain" />
        </SelectTrigger>
        <SelectContent>
          {domains.map((d) => (
            <SelectItem key={`${d.chain}-${d.domain}`} value={d.domain}>
              <span className="flex items-center gap-2">
                {d.domain}
                <Badge
                  variant="secondary"
                  className={`text-xs ${CHAIN_COLORS[d.chain] ?? ""}`}
                >
                  {CHAIN_LABELS[d.chain] ?? d.chain.toUpperCase()}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {setPrimary.isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
