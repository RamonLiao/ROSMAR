"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useSegment,
  useUpdateSegment,
  useRefreshSegment,
  useDeleteSegment,
} from "@/lib/hooks/use-segments";
import { hasRules } from "@/components/segment/rule-builder";

export default function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: segment, isLoading, error } = useSegment(id);
  const { mutateAsync: updateSegment, isPending: isUpdating } =
    useUpdateSegment();
  const { mutateAsync: refreshSegment, isPending: isRefreshing } =
    useRefreshSegment();
  const { mutateAsync: deleteSegment, isPending: isDeleting } =
    useDeleteSegment();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const startEditing = () => {
    if (!segment) return;
    setName(segment.name);
    setDescription(segment.description ?? "");
    setUpdateError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setUpdateError(null);
  };

  const handleSave = async () => {
    if (!segment || !name.trim()) return;
    setUpdateError(null);
    try {
      await updateSegment({
        id: segment.id,
        name: name.trim(),
        description: description.trim() || undefined,
        expectedVersion: segment.version,
      });
      setEditing(false);
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update segment");
    }
  };

  const handleRefresh = async () => {
    if (!segment) return;
    await refreshSegment(segment.id);
  };

  const handleDelete = async () => {
    if (!segment || !confirm("Delete this segment? This cannot be undone.")) return;
    await deleteSegment(segment.id);
    router.push("/segments");
  };

  const memberCount = segment?._count?.memberships ?? 0;
  const isDynamic = hasRules(segment?.rules);

  // Summarize rules for display
  const rulesSummary = (() => {
    if (!isDynamic || !segment) return null;
    const r = segment.rules as { groups?: { logic: string; conditions: { field: string; operator: string; value: string }[] }[] };
    if (!r.groups) return null;
    return r.groups.map((g, i) => {
      const conds = g.conditions
        .map((c) => `${c.field} ${c.operator.replace("_", " ")} "${c.value}"`)
        .join(` ${g.logic} `);
      return `Group ${i + 1}: ${conds}`;
    });
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load segment
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
            {segment.name}
          </h1>
          <p className="text-muted-foreground tracking-tight">
            Created {new Date(segment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={isDynamic ? "default" : "secondary"}>
          {isDynamic ? "Dynamic" : "Static"}
        </Badge>
        {!editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
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
      </div>

      {updateError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {updateError}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{memberCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Segment name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Segment description"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Name</div>
                <div className="mt-1 font-medium">{segment.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Members</div>
                <div className="mt-1 font-medium">{memberCount}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1 text-sm">
                  {segment.description || (
                    <span className="text-muted-foreground">No description</span>
                  )}
                </div>
              </div>
              {segment.lastRefreshedAt && (
                <div>
                  <div className="text-sm text-muted-foreground">
                    Last Refreshed
                  </div>
                  <div className="mt-1 text-sm">
                    {new Date(segment.lastRefreshedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {rulesSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {rulesSummary.map((line, i) => (
                <li key={i} className="font-mono text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {memberCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members yet. Click Refresh to evaluate segment rules.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {memberCount} profile(s) match this segment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
