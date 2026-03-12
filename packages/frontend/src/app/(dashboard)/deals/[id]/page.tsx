"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealDocuments } from "@/components/deal/deal-documents";
import { EscrowTabContent } from "@/components/deal/escrow-tab-content";
import { ArrowLeft, Pencil, X, Loader2, DollarSign, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeal, useUpdateDeal, useDealRoomAccess } from "@/lib/hooks/use-deals";
import { DEAL_STAGES } from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: deal, isLoading, error } = useDeal(id);
  const { data: accessData } = useDealRoomAccess(id);
  const hasRoomAccess = accessData?.hasAccess ?? false;
  const { mutateAsync: updateDeal, isPending: isUpdating } = useUpdateDeal();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [stage, setStage] = useState("");
  const [notes, setNotes] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const startEditing = () => {
    if (!deal) return;
    setTitle(deal.title);
    setAmountUsd(String(deal.amountUsd));
    setStage(deal.stage);
    setNotes(deal.notes ?? "");
    setUpdateError(null);
    setEditing(true);
  };

  const isClosed =
    deal?.stage === "closed_won" || deal?.stage === "closed_lost";

  const cancelEditing = () => {
    setEditing(false);
    setUpdateError(null);
  };

  const handleSave = async () => {
    if (!deal || !title.trim() || !amountUsd) return;
    setUpdateError(null);

    try {
      await updateDeal({
        id: deal.id,
        title: title.trim(),
        amountUsd: Number(amountUsd),
        stage,
        notes,
        expectedVersion: deal.version,
      });
      setEditing(false);
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update deal");
    }
  };

  const stageLabel =
    DEAL_STAGES.find((s) => s.value === deal?.stage)?.label ?? deal?.stage;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load deal
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
            {deal.title}
          </h1>
          <p className="text-muted-foreground tracking-tight">Deal details</p>
        </div>
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
              disabled={isUpdating || !title.trim() || !amountUsd}
            >
              {isUpdating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {updateError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {updateError}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="escrow">Escrow</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {isClosed && (
                    <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      This deal is closed. Only the stage can be changed.
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isClosed}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Amount USD</Label>
                    <Input
                      type="number"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                      disabled={isClosed}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Stage</Label>
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
                    <Label>Profile ID</Label>
                    <Input
                      value={deal.profileId}
                      disabled
                      className="text-muted-foreground"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="mt-1 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-lg font-semibold">
                        {Number(deal.amountUsd).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Stage</div>
                    <div className="mt-1 font-medium">{stageLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Profile</div>
                    <div className="mt-1 text-sm break-all">{deal.profileId}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Created</div>
                    <div className="mt-1">
                      {new Date(deal.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={4}
                  disabled={isClosed}
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {deal.notes || "No notes"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          {hasRoomAccess ? (
            <DealDocuments
              dealId={deal.id}
              workspaceId={deal.workspaceId as string}
            />
          ) : (
            <AccessDeniedPanel />
          )}
        </TabsContent>

        <TabsContent value="escrow">
          {hasRoomAccess ? (
            <EscrowTabContent dealId={deal.id} />
          ) : (
            <AccessDeniedPanel />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccessDeniedPanel() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Access Restricted</h3>
      <p className="text-muted-foreground mt-2 text-sm max-w-xs">
        Only deal participants, escrow parties, and workspace admins can view
        this section. Contact an admin to request access.
      </p>
    </div>
  );
}
