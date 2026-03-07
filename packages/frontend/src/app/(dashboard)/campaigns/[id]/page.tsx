"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignStats } from "@/components/campaign/campaign-stats";
import { AiSuggestButton } from "@/components/campaign/ai-suggest-button";
import { ActionPlanWizard } from "@/components/campaign/action-plan-wizard";
import { ArrowLeft, Settings, Pencil, X, Loader2, Play, Pause } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCampaign,
  useUpdateCampaign,
  useStartCampaign,
  usePauseCampaign,
  useCampaignStats,
} from "@/lib/hooks/use-campaigns";

const STATUS_OPTIONS = ["draft", "active", "paused", "completed"] as const;

const statusColor: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-400/30",
  paused: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-400/30",
  completed: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-primary/15 dark:text-primary dark:border-primary/30",
  draft: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: campaign, isLoading, error } = useCampaign(id);
  const { data: stats } = useCampaignStats(id);
  const { mutateAsync: updateCampaign, isPending: isUpdating } =
    useUpdateCampaign();
  const { mutateAsync: startCampaign, isPending: isStarting } =
    useStartCampaign();
  const { mutateAsync: pauseCampaign, isPending: isPausing } =
    usePauseCampaign();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const startEditing = () => {
    if (!campaign) return;
    setName(campaign.name);
    setDescription(campaign.description ?? "");
    setStatus(campaign.status);
    setUpdateError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setUpdateError(null);
  };

  const handleSave = async () => {
    if (!campaign || !name.trim()) return;
    setUpdateError(null);

    try {
      await updateCampaign({
        id: campaign.id,
        name: name.trim(),
        description,
        status,
        expectedVersion: campaign.version,
      });
      setEditing(false);
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update campaign");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load campaign
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          <p className="text-muted-foreground tracking-tight">
            Created {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className={statusColor[campaign.status] ?? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border"}>
          {campaign.status}
        </Badge>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating || !name.trim()}
            >
              {isUpdating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        )}
        {campaign.status === "draft" || campaign.status === "paused" ? (
          <Button
            variant="default"
            size="sm"
            disabled={isStarting}
            onClick={async () => {
              try {
                await startCampaign(id);
              } catch (err: any) {
                setUpdateError(err?.message || "Failed to start campaign");
              }
            }}
          >
            {isStarting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start
          </Button>
        ) : campaign.status === "active" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isPausing}
            onClick={async () => {
              try {
                await pauseCampaign(id);
              } catch (err: any) {
                setUpdateError(err?.message || "Failed to pause campaign");
              }
            }}
          >
            {isPausing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Pause className="mr-2 h-4 w-4" />
            )}
            Pause
          </Button>
        ) : null}
        <ActionPlanWizard />
        <Button
          variant="outline"
          onClick={() => router.push(`/campaigns/${id}/workflow`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Edit Workflow
        </Button>
      </div>

      {updateError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {updateError}
        </div>
      )}

      <CampaignStats
        sent={stats?.segmentSize ?? 0}
        opened={0}
        converted={0}
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <AiSuggestButton
                    segmentDescription={campaign.segment?.name}
                    onContentGenerated={(content) => setDescription(content)}
                  />
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Campaign description..."
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1 font-medium">{campaign.status}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Target Segment
                </div>
                <div className="mt-1 font-medium">
                  {campaign.segment?.name ?? campaign.segmentId}
                </div>
              </div>
              {campaign.startedAt && (
                <div>
                  <div className="text-sm text-muted-foreground">
                    Started At
                  </div>
                  <div className="mt-1">
                    {new Date(campaign.startedAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!editing && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {campaign.description || "No description"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
