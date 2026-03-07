"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useGenerateContent } from "@/lib/hooks/use-content-agent";

const CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "email", label: "Email" },
  { value: "x", label: "X / Twitter" },
] as const;

const TONES = [
  "professional",
  "casual",
  "friendly",
  "witty",
  "urgent",
  "formal",
] as const;

interface AiSuggestButtonProps {
  segmentDescription?: string;
  onContentGenerated: (content: string, subject?: string) => void;
}

export function AiSuggestButton({
  segmentDescription = "",
  onContentGenerated,
}: AiSuggestButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(segmentDescription);
  const [channel, setChannel] = useState<string>("telegram");
  const [tone, setTone] = useState<string>("professional");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: generateContent, isPending } = useGenerateContent();

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setError(null);

    try {
      const result = await generateContent({
        segmentDescription: description.trim(),
        channel: channel as "telegram" | "discord" | "email" | "x",
        tone,
      });
      onContentGenerated(result.content, result.subject);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to generate content");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Sparkles className="mr-2 h-4 w-4" />
          AI Suggest
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-1">
            <h4 className="font-medium leading-none">AI Content Generator</h4>
            <p className="text-sm text-muted-foreground">
              Describe your target audience and we will generate copy.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ai-segment">Target Audience</Label>
              <Textarea
                id="ai-segment"
                placeholder="e.g., Active NFT collectors with 10+ mints"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-channel">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger id="ai-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-tone">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="ai-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isPending || !description.trim()}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
