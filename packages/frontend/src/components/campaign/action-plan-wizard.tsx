"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Wand2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  usePlanAction,
  useExecuteAction,
  type ActionPlan,
} from "@/lib/hooks/use-action-agent";

type WizardStep = "input" | "review" | "success" | "error";

export function ActionPlanWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("input");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { mutateAsync: planAction, isPending: isPlanning } = usePlanAction();
  const { mutateAsync: executeAction, isPending: isExecuting } =
    useExecuteAction();

  const reset = () => {
    setStep("input");
    setInstruction("");
    setPlan(null);
    setErrorMsg("");
  };

  const handlePlan = async () => {
    if (!instruction.trim()) return;
    setErrorMsg("");

    try {
      const result = await planAction({ instruction: instruction.trim() });
      setPlan(result);
      setStep("review");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to generate plan");
      setStep("error");
    }
  };

  const handleExecute = async () => {
    if (!plan) return;
    setErrorMsg("");

    try {
      await executeAction({ planId: plan.planId });
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to execute plan");
      setStep("error");
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wand2 className="mr-2 h-4 w-4" />
          AI Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>AI Campaign Planner</DialogTitle>
          <DialogDescription>
            Describe what you want to do in plain language.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-instruction">Instruction</Label>
              <Textarea
                id="ai-instruction"
                placeholder='e.g., "Send a Telegram message to all NFT whales about our new airdrop"'
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handlePlan}
                disabled={isPlanning || !instruction.trim()}
              >
                {isPlanning && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate Plan
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "review" && plan && (
          <div className="grid gap-4 py-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Segment:</span>{" "}
                  <span className="font-medium">{plan.targetSegment}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Estimated Cost:
                  </span>{" "}
                  <span className="font-medium">
                    ${plan.estimatedCost.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actions:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {plan.actions.map((action, i) => (
                      <Badge key={i} variant="outline">
                        {action.type}
                      </Badge>
                    ))}
                    {plan.actions.length === 0 && (
                      <span className="text-muted-foreground">
                        No actions generated
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={reset}>
                Back
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isExecuting || plan.actions.length === 0}
              >
                {isExecuting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm &amp; Execute
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div>
              <p className="font-medium">Plan executed successfully!</p>
              <p className="text-sm text-muted-foreground">
                The workflow has been started for the target segment.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={reset}>
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
