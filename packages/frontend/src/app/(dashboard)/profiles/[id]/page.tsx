"use client";

import { use, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProfileCard } from "@/components/profile/profile-card";
import { ProfileTimeline } from "@/components/profile/profile-timeline";
import { AssetGallery } from "@/components/profile/asset-gallery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, X, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProfile, useUpdateProfileTags, useProfileOrganizations } from "@/lib/hooks/use-profiles";
import { useSendMessage, useMessageHistory } from "@/lib/hooks/use-messaging";
import { Textarea } from "@/components/ui/textarea";

export default function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile(id);
  const { mutateAsync: updateTags, isPending: isUpdating } =
    useUpdateProfileTags();
  const { data: relatedOrgs, isLoading: orgsLoading } = useProfileOrganizations(id);

  const { data: messageHistory } = useMessageHistory(id);
  const sendMessage = useSendMessage();
  const [msgChannel, setMsgChannel] = useState("email");
  const [msgBody, setMsgBody] = useState("");

  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const startEditing = () => {
    if (!profile) return;
    setTags(profile.tags ?? []);
    setTagInput("");
    setUpdateError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setUpdateError(null);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = tagInput.trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!profile) return;
    setUpdateError(null);
    try {
      await updateTags({
        id: profile.id,
        tags,
        expectedVersion: profile.version,
      });
      setEditing(false);
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update tags");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load profile
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
            Profile Detail
          </h1>
          <p className="text-muted-foreground tracking-tight">
            360° view of {profile.suinsName ?? profile.primaryAddress}
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
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
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

      <ProfileCard
        address={profile.primaryAddress}
        suinsName={profile.suinsName ?? undefined}
        tier={profile.tier}
        score={profile.engagementScore}
      />

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
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
                className="max-w-xs"
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(profile.tags ?? []).length > 0 ? (
                profile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">
                Primary Address
              </div>
              <div className="mt-1 text-sm break-all">
                {profile.primaryAddress}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">SuiNS Name</div>
              <div className="mt-1 font-medium">
                {profile.suinsName ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tier</div>
              <div className="mt-1 font-medium">{profile.tier}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Engagement Score
              </div>
              <div className="mt-1 font-medium">{profile.engagementScore}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="mt-1">
                {new Date(profile.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activity" className="space-y-4">
        <div className="sticky top-0 z-10 bg-muted/30 dark:bg-muted/10 -mx-1 px-1 py-2">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="orgs">Related Orgs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity">
          <ProfileTimeline profileId={params.id} />
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Send Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <select
                  value={msgChannel}
                  onChange={(e) => setMsgChannel(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                  <option value="discord">Discord</option>
                </select>
                <Button
                  size="sm"
                  disabled={!msgBody.trim() || sendMessage.isPending}
                  onClick={() => {
                    sendMessage.mutate(
                      {
                        channel: msgChannel,
                        profileId: id,
                        ...(msgChannel === "email"
                          ? { subject: "Message from ROSMAR", body: msgBody }
                          : msgChannel === "telegram"
                            ? { message: msgBody }
                            : { content: msgBody }),
                      },
                      { onSuccess: () => setMsgBody("") },
                    );
                  }}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Message History</CardTitle>
            </CardHeader>
            <CardContent>
              {messageHistory?.messages && messageHistory.messages.length > 0 ? (
                <div className="space-y-3">
                  {messageHistory.messages.map((msg: any) => (
                    <div key={msg.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{msg.channel}</Badge>
                          <Badge variant={msg.status === "sent" ? "default" : "destructive"} className="text-xs">
                            {msg.status}
                          </Badge>
                        </div>
                        {msg.subject && <p className="text-sm font-medium">{msg.subject}</p>}
                        <p className="text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground tracking-tight">No messages yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <AssetGallery profileId={params.id} />
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground tracking-tight">
                No notes yet
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgs">
          <Card>
            <CardHeader>
              <CardTitle>Related Organizations</CardTitle>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : relatedOrgs && relatedOrgs.length > 0 ? (
                <div className="space-y-3">
                  {relatedOrgs.map((org) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/organizations/${org.id}`)}
                    >
                      <div>
                        <div className="font-medium">{org.name}</div>
                        {org.domain && (
                          <div className="text-sm text-muted-foreground">{org.domain}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {org.tags?.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground tracking-tight">
                  No related organizations
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
