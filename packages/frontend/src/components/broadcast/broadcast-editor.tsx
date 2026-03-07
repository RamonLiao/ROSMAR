"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChannelPicker } from "./channel-picker";
import {
  useCreateBroadcast,
  useUpdateBroadcast,
  useSendBroadcast,
  useScheduleBroadcast,
  type Broadcast,
} from "@/lib/hooks/use-broadcasts";
import { Loader2, Send, Clock } from "lucide-react";

interface BroadcastEditorProps {
  broadcast?: Broadcast;
  onSaved?: () => void;
}

export function BroadcastEditor({ broadcast, onSaved }: BroadcastEditorProps) {
  const [title, setTitle] = useState(broadcast?.title ?? "");
  const [content, setContent] = useState(broadcast?.content ?? "");
  const [channels, setChannels] = useState<string[]>(broadcast?.channels ?? []);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  const createMutation = useCreateBroadcast();
  const updateMutation = useUpdateBroadcast();
  const sendMutation = useSendBroadcast();
  const scheduleMutation = useScheduleBroadcast();

  const isExisting = !!broadcast;
  const isDraft = !broadcast || broadcast.status === "draft";
  const saving = createMutation.isPending || updateMutation.isPending;
  const sending = sendMutation.isPending;
  const scheduling = scheduleMutation.isPending;

  async function handleSave() {
    if (isExisting) {
      await updateMutation.mutateAsync({ id: broadcast.id, title, content, channels });
    } else {
      await createMutation.mutateAsync({ title, content, channels });
    }
    onSaved?.();
  }

  async function handleSend() {
    if (!broadcast) return;
    await sendMutation.mutateAsync(broadcast.id);
    onSaved?.();
  }

  async function handleSchedule() {
    if (!broadcast || !scheduledAt) return;
    await scheduleMutation.mutateAsync({ id: broadcast.id, scheduledAt });
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Broadcast title"
          disabled={!isDraft}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your broadcast message..."
          rows={6}
          disabled={!isDraft}
        />
      </div>

      <ChannelPicker selected={channels} onChange={setChannels} />

      {isDraft && (
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving || !title || !content}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExisting ? "Update Draft" : "Save Draft"}
          </Button>

          {isExisting && (
            <>
              <Button variant="default" onClick={handleSend} disabled={sending || channels.length === 0}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Now
              </Button>

              <Button variant="outline" onClick={() => setShowSchedule(!showSchedule)}>
                <Clock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </>
          )}
        </div>
      )}

      {showSchedule && isDraft && isExisting && (
        <div className="flex gap-2 items-end">
          <div className="space-y-2 flex-1">
            <Label htmlFor="scheduledAt">Schedule Date/Time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <Button onClick={handleSchedule} disabled={scheduling || !scheduledAt}>
            {scheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Schedule
          </Button>
        </div>
      )}
    </div>
  );
}
