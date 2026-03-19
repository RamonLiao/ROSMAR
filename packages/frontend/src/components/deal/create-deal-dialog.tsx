"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useCreateDeal } from "@/lib/hooks/use-deals";
import { useProfiles } from "@/lib/hooks/use-profiles";
import { DEAL_STAGES } from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";

export function CreateDealDialog() {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [stage, setStage] = useState("prospecting");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: createDeal, isPending } = useCreateDeal();
  const { data: profilesData, isLoading: profilesLoading } = useProfiles({ limit: 100 });

  const profiles = profilesData?.profiles ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !title.trim() || !amountUsd) return;
    setError(null);

    try {
      await createDeal({
        profileId,
        title: title.trim(),
        amountUsd: Number(amountUsd),
        stage,
        notes: notes.trim() || undefined,
      });
      setOpen(false);
      setProfileId("");
      setTitle("");
      setAmountUsd("");
      setStage("prospecting");
      setNotes("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create deal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Deal</DialogTitle>
            <DialogDescription>
              Add a new deal to your pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profileId">Profile *</Label>
              {profilesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading profiles...
                </div>
              ) : profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No profiles yet. Create a profile first.
                </p>
              ) : (
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.suinsName || p.primaryAddress.slice(0, 10) + "..."}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enterprise contract Q2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amountUsd">Amount USD *</Label>
              <Input
                id="amountUsd"
                type="number"
                placeholder="10000"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stage">Stage *</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this deal..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive mb-2">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isPending ||
                !profileId ||
                !title.trim() ||
                !amountUsd
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
