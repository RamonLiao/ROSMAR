"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";
import {
  useEscrow,
  useCreateEscrow,
  useFundEscrow,
  useReleaseEscrow,
  useRaiseDispute,
  useVoteOnDispute,
} from "@/lib/hooks/use-escrow";
import { EscrowPanel } from "./escrow-panel";
import { SaftTemplatePicker } from "./saft-template-picker";
import { SaftTermsForm } from "./saft-terms-form";

interface EscrowTabContentProps {
  dealId: string;
  currentUserAddress?: string;
}

export function EscrowTabContent({
  dealId,
  currentUserAddress,
}: EscrowTabContentProps) {
  const { data: escrow, isLoading } = useEscrow(dealId);
  const { mutateAsync: createEscrow, isPending: isCreating } = useCreateEscrow();
  const { mutateAsync: fundEscrow } = useFundEscrow();
  const { mutateAsync: releaseEscrow } = useReleaseEscrow();
  const { mutateAsync: raiseDispute } = useRaiseDispute();
  const { mutateAsync: voteOnDispute } = useVoteOnDispute();

  const [showSaftForm, setShowSaftForm] = useState(false);

  // Create escrow form state
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState("SUI");
  const [arbitrators, setArbitrators] = useState("");
  const [threshold, setThreshold] = useState("2");

  const handleCreateEscrow = async () => {
    if (!payee || !amount) return;
    await createEscrow({
      dealId,
      payee,
      totalAmount: amount,
      tokenType,
      arbitrators: arbitrators
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      arbiterThreshold: Number(threshold),
    });
  };

  const handleAction = async (action: string, data?: unknown) => {
    const d = data as Record<string, string> | undefined;
    switch (action) {
      case "fund":
        await fundEscrow({ dealId, amount: d?.amount ?? "0" });
        break;
      case "release":
        await releaseEscrow({ dealId, amount: d?.amount ?? "0" });
        break;
      case "dispute":
        await raiseDispute({ dealId, reason: d?.reason });
        break;
      case "vote":
        await voteOnDispute({
          dealId,
          vote: (d?.vote as "release" | "refund") ?? "release",
        });
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-muted-foreground">Loading escrow...</span>
      </div>
    );
  }

  if (!escrow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create Escrow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="escrow-payee">Payee Address</Label>
              <Input
                id="escrow-payee"
                placeholder="0x..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="escrow-amount">Total Amount</Label>
              <Input
                id="escrow-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="escrow-token">Token Type</Label>
              <Input
                id="escrow-token"
                value={tokenType}
                onChange={(e) => setTokenType(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="escrow-threshold">Arbiter Threshold</Label>
              <Input
                id="escrow-threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="escrow-arbitrators">
                Arbitrator Addresses (comma-separated)
              </Label>
              <Input
                id="escrow-arbitrators"
                placeholder="0xabc..., 0xdef..."
                value={arbitrators}
                onChange={(e) => setArbitrators(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleCreateEscrow}
            disabled={!payee || !amount || isCreating}
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Escrow
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <EscrowPanel
        escrow={escrow}
        currentUserAddress={currentUserAddress}
        onAction={handleAction}
      />

      <SaftTemplatePicker
        templates={escrow.saftTemplates ?? []}
        onSelect={() => setShowSaftForm(true)}
        onCreate={() => setShowSaftForm(true)}
      />

      {showSaftForm && (
        <Card>
          <CardHeader>
            <CardTitle>SAFT Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <SaftTermsForm onSubmit={(terms) => setShowSaftForm(false)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
