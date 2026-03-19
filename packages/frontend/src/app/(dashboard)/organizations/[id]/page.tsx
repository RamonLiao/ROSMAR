"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, Pencil, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useOrganization,
  useUpdateOrganization,
  useOrganizationProfiles,
  useLinkProfile,
  useUnlinkProfile,
} from "@/lib/hooks/use-organizations";
import { useProfiles } from "@/lib/hooks/use-profiles";

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: org, isLoading, error } = useOrganization(id);
  const { mutateAsync: updateOrganization, isPending: isUpdating } =
    useUpdateOrganization();
  const { data: members, isLoading: membersLoading } = useOrganizationProfiles(id);
  const { mutateAsync: linkProfile, isPending: isLinking } = useLinkProfile();
  const { mutateAsync: unlinkProfile } = useUnlinkProfile();
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const { data: profilesData } = useProfiles({ search: memberSearch || undefined, limit: 10 });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const startEditing = () => {
    if (!org) return;
    setName(org.name);
    setDomain(org.domain ?? "");
    setTags([...org.tags]);
    setTagInput("");
    setUpdateError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setUpdateError(null);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!org || !name.trim()) return;
    setUpdateError(null);

    try {
      await updateOrganization({
        id: org.id,
        name: name.trim(),
        domain: domain.trim() || undefined,
        tags,
        expectedVersion: org.version,
      });
      setEditing(false);
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update organization");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load organization
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
          <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground tracking-tight">
            Organization details
          </p>
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
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Domain</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. example.com"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tag and press Enter"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Domain</div>
                <div className="mt-1 flex items-center gap-2">
                  {org.domain ? (
                    <>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{org.domain}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Members</div>
                <div className="mt-1">
                  {org._count?.profiles?.toLocaleString() ?? "0"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tags</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {org.tags.length > 0 ? (
                    org.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="mt-1">
                  {new Date(org.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddMember(!showAddMember)}>
            {showAddMember ? "Cancel" : "Add Member"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddMember && (
            <div className="rounded-lg border p-3 space-y-2">
              <Input
                placeholder="Search profiles..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {profilesData?.profiles && profilesData.profiles.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {profilesData.profiles.map((p) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      onClick={async () => {
                        await linkProfile({ orgId: id, profileId: p.id });
                        setShowAddMember(false);
                        setMemberSearch("");
                      }}
                      disabled={isLinking}
                    >
                      <span>{p.suinsName || p.primaryAddress.slice(0, 10) + "..."}</span>
                      <Badge variant="secondary" className="text-xs">Tier {p.tier}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {membersLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{m.suinsName || m.primaryAddress.slice(0, 16) + "..."}</div>
                    <div className="text-xs text-muted-foreground break-all">{m.primaryAddress}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Tier {m.tier}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => unlinkProfile({ orgId: id, profileId: m.id })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No members yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
