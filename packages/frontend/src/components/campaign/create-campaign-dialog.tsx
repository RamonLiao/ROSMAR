"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useCreateCampaign } from "@/lib/hooks/use-campaigns";
import { useSegments } from "@/lib/hooks/use-segments";

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign();
  const { data: segmentsData, isLoading: segmentsLoading } = useSegments();

  const segments = segmentsData?.segments ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !segmentId) return;

    try {
      await createCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
        segmentId,
        workflowSteps: [],
      });
      setOpen(false);
      setName("");
      setDescription("");
      setSegmentId("");
    } catch (err) {
      console.error("Failed to create campaign:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Add a new marketing campaign to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Q2 Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Campaign description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Target Segment *</Label>
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger>
                  <SelectValue placeholder={segmentsLoading ? "Loading segments..." : "Select a segment"} />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((seg) => (
                    <SelectItem key={seg.id} value={seg.id}>
                      {seg.name}
                    </SelectItem>
                  ))}
                  {!segmentsLoading && segments.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No segments found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !name.trim() || !segmentId}
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
