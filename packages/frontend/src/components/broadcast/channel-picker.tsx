"use client";

import { Label } from "@/components/ui/label";

const CHANNELS = [
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "x", label: "X (Twitter)" },
];

interface ChannelPickerProps {
  selected: string[];
  onChange: (channels: string[]) => void;
}

export function ChannelPicker({ selected, onChange }: ChannelPickerProps) {
  const toggle = (channelId: string) => {
    if (selected.includes(channelId)) {
      onChange(selected.filter((c) => c !== channelId));
    } else {
      onChange([...selected, channelId]);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Channels</Label>
      <div className="flex gap-4">
        {CHANNELS.map((ch) => (
          <label key={ch.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(ch.id)}
              onChange={() => toggle(ch.id)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">{ch.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
