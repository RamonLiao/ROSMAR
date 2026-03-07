"use client";

import { useState } from "react";
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
import { Banknote, Send, AlertTriangle, Vote } from "lucide-react";

// ── Fund Dialog ────────────────────────────────────────

interface FundDialogProps {
  onConfirm: (amount: string) => void;
  isPending?: boolean;
}

export function FundDialog({ onConfirm, isPending }: FundDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const handleConfirm = () => {
    if (!amount) return;
    onConfirm(amount);
    setOpen(false);
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Banknote className="mr-2 h-4 w-4" />
          Fund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund Escrow</DialogTitle>
          <DialogDescription>
            Enter the amount to deposit into the escrow.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="fund-amount">Amount</Label>
          <Input
            id="fund-amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!amount || isPending}
          >
            Confirm Fund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Release Dialog ─────────────────────────────────────

interface ReleaseDialogProps {
  totalAmount: string;
  releasedAmount: string;
  onConfirm: (amount: string) => void;
  isPending?: boolean;
}

export function ReleaseDialog({
  totalAmount,
  releasedAmount,
  onConfirm,
  isPending,
}: ReleaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const remaining = Number(totalAmount) - Number(releasedAmount);

  const handleReleaseAll = () => {
    onConfirm(String(remaining));
    setOpen(false);
  };

  const handleConfirm = () => {
    if (!amount) return;
    onConfirm(amount);
    setOpen(false);
    setAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="mr-2 h-4 w-4" />
          Release
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release Funds</DialogTitle>
          <DialogDescription>
            Release funds to the payee. Remaining: {remaining.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="release-amount">Amount</Label>
          <Input
            id="release-amount"
            type="number"
            placeholder="0.00"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReleaseAll} disabled={isPending}>
            Release All
          </Button>
          <Button onClick={handleConfirm} disabled={!amount || isPending}>
            Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dispute Dialog ─────────────────────────────────────

interface DisputeDialogProps {
  onConfirm: (reason?: string) => void;
  isPending?: boolean;
}

export function DisputeDialog({ onConfirm, isPending }: DisputeDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise Dispute</DialogTitle>
          <DialogDescription>
            This will freeze the escrow and require arbitrator votes to resolve.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            Confirm Dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vote Dialog ────────────────────────────────────────

interface VoteDialogProps {
  onConfirm: (vote: "release" | "refund") => void;
  isPending?: boolean;
}

export function VoteDialog({ onConfirm, isPending }: VoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState<"release" | "refund">("release");

  const handleConfirm = () => {
    onConfirm(vote);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Vote className="mr-2 h-4 w-4" />
          Vote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vote on Dispute</DialogTitle>
          <DialogDescription>
            Cast your vote to resolve this dispute.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="vote"
              value="release"
              checked={vote === "release"}
              onChange={() => setVote("release")}
            />
            <span className="text-sm">Release to Payee</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="vote"
              value="refund"
              checked={vote === "refund"}
              onChange={() => setVote("refund")}
            />
            <span className="text-sm">Refund to Payer</span>
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isPending}>
            Submit Vote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
