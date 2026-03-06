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
import { Plus, Loader2 } from "lucide-react";
import { useCreateProfile } from "@/lib/hooks/use-profiles";

export function CreateProfileDialog() {
  const [open, setOpen] = useState(false);
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [suinsName, setSuinsName] = useState("");
  const [tags, setTags] = useState("");
  const { mutateAsync: createProfile, isPending } = useCreateProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryAddress.trim()) return;

    try {
      await createProfile({
        primaryAddress: primaryAddress.trim(),
        suinsName: suinsName.trim() || undefined,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()) : undefined,
      });
      setOpen(false);
      setPrimaryAddress("");
      setSuinsName("");
      setTags("");
    } catch (err) {
      console.error("Failed to create profile:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Profile</DialogTitle>
            <DialogDescription>
              Add a new customer profile to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="primaryAddress">Wallet Address *</Label>
              <Input
                id="primaryAddress"
                placeholder="0x..."
                value={primaryAddress}
                onChange={(e) => setPrimaryAddress(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="suinsName">SuiNS Name</Label>
              <Input
                id="suinsName"
                placeholder="name.sui"
                value={suinsName}
                onChange={(e) => setSuinsName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="vip, early-adopter, whale"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of tags
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !primaryAddress.trim()}>
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
