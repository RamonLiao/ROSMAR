"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowCanvas } from "@/components/campaign/workflow-canvas";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCampaign,
  useUpdateCampaign,
  type WorkflowStep,
} from "@/lib/hooks/use-campaigns";

/* ── Action palette config ── */
const ACTIONS = [
  { type: "send_telegram", label: "Send Telegram", enabled: true },
  { type: "send_discord", label: "Send Discord", enabled: true },
  { type: "send_email", label: "Send Email", enabled: false },
  { type: "airdrop_token", label: "Airdrop Token", enabled: true },
  { type: "add_to_segment", label: "Add to Segment", enabled: false },
  { type: "update_tier", label: "Update Tier", enabled: false },
  { type: "wait_delay", label: "Wait Delay", enabled: false },
  { type: "condition", label: "Condition", enabled: false },
] as const;

export default function WorkflowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: campaign, isLoading } = useCampaign(params.id);
  const updateCampaign = useUpdateCampaign();

  // Local steps state — initialized from API, then managed locally
  const [localSteps, setLocalSteps] = useState<WorkflowStep[] | null>(null);
  const initialized = useRef(false);

  // Initialize localSteps from campaign data once
  useEffect(() => {
    if (campaign && !initialized.current) {
      const apiSteps = Array.isArray(campaign.workflowSteps)
        ? campaign.workflowSteps
        : [];
      setLocalSteps(apiSteps);
      initialized.current = true;
    }
  }, [campaign]);

  const handleCanvasChange = useCallback((steps: WorkflowStep[]) => {
    setLocalSteps(steps);
  }, []);

  const handleAddAction = useCallback((actionType: string) => {
    setLocalSteps((prev) => [
      ...(prev || []),
      { type: actionType, config: {} },
    ]);
  }, []);

  const handleSave = useCallback(() => {
    if (!campaign || !localSteps) return;
    updateCampaign.mutate(
      {
        id: params.id,
        workflowSteps: localSteps,
        expectedVersion: campaign.version,
      },
      {
        onSuccess: () => router.push(`/campaigns/${params.id}`),
      }
    );
  }, [campaign, localSteps, params.id, router, updateCampaign]);

  if (isLoading || localSteps === null) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Campaign not found
      </div>
    );
  }

  const isReadOnly =
    campaign.status === "active" || campaign.status === "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Workflow Editor
          </h1>
          <p className="text-muted-foreground tracking-tight">
            {campaign.name}
            {isReadOnly
              ? ` — Read-only (campaign is ${campaign.status})`
              : " — Design your automation flow"}
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={handleSave} disabled={updateCampaign.isPending}>
            {updateCampaign.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Workflow
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Canvas</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowCanvas steps={localSteps} onChange={handleCanvasChange} />
        </CardContent>
      </Card>

      {!isReadOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Available Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {ACTIONS.map((action) => (
                <Button
                  key={action.type}
                  variant="outline"
                  size="sm"
                  disabled={!action.enabled}
                  onClick={() => handleAddAction(action.type)}
                >
                  {action.label}
                  {!action.enabled && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (soon)
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
