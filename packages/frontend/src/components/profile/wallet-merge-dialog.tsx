"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, GitMerge, AlertTriangle } from "lucide-react";

interface MergeCandidate {
  profileId: string;
  sharedAddresses: string[];
}

interface WalletMergeDialogProps {
  profileId: string;
  /** Called after a successful merge */
  onMerged?: () => void;
}

export function useProfileMergeCandidate(profileId: string) {
  return useQuery({
    queryKey: ["profile-merge-candidate", profileId],
    queryFn: async () => {
      const res = await apiClient.get<{ candidate: MergeCandidate | null }>(
        `/profiles/${profileId}/merge-candidates`
      );
      return res.candidate;
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

function useMergeProfile(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceProfileId: string) => {
      return apiClient.post(`/profiles/${profileId}/merge`, {
        sourceProfileId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({
        queryKey: ["profile-merge-candidate", profileId],
      });
    },
  });
}

export function WalletMergeDialog({
  profileId,
  onMerged,
}: WalletMergeDialogProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data: candidate, isLoading } = useProfileMergeCandidate(profileId);
  const { mutateAsync: merge, isPending } = useMergeProfile(profileId);

  const open = !dismissed && !isLoading && !!candidate;

  const handleMerge = async () => {
    if (!candidate) return;
    try {
      await merge(candidate.profileId);
      onMerged?.();
    } catch (err) {
      console.error("Profile merge failed:", err);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setDismissed(true)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-amber-500" />
            Duplicate Profile Detected
          </DialogTitle>
          <DialogDescription>
            This profile shares{" "}
            {candidate!.sharedAddresses.length === 1
              ? "a wallet address"
              : `${candidate!.sharedAddresses.length} wallet addresses`}{" "}
            with another profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Shared addresses:</p>
                <ul className="mt-1 space-y-1">
                  {candidate!.sharedAddresses.map((addr) => (
                    <li key={addr} className="font-mono text-xs break-all">
                      {addr}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Merging will move all records (deals, wallets, messages, etc.) from
            the other profile into this one. The other profile will be archived.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Keep Separate
          </Button>
          <Button onClick={handleMerge} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Merge Profiles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
