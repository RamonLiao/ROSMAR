"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookTemplate, ChevronRight, Zap } from "lucide-react";

export interface PlaybookStep {
  type: string;
  config: Record<string, unknown>;
  delay?: number;
}

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  steps: PlaybookStep[];
}

const ACTION_LABELS: Record<string, string> = {
  send_telegram: "Send Telegram",
  send_discord: "Send Discord",
  airdrop_token: "Airdrop Token",
  grant_discord_role: "Grant Discord Role",
  issue_poap: "Issue POAP",
  ai_generate_content: "AI Generate Content",
};

interface PlaybookPickerProps {
  templates: PlaybookTemplate[];
  onSelect: (template: PlaybookTemplate) => void;
}

export function PlaybookPicker({ templates, onSelect }: PlaybookPickerProps) {
  const [previewTemplate, setPreviewTemplate] =
    useState<PlaybookTemplate | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => setPreviewTemplate(tpl)}
            data-testid={`playbook-card-${tpl.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BookTemplate className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  {tpl.name}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {tpl.description}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Zap className="mr-1 h-3 w-3" />
                  {tpl.triggerType.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {tpl.steps.length} step{tpl.steps.length !== 1 ? "s" : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      >
        <DialogContent className="sm:max-w-md">
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTemplate.name}</DialogTitle>
                <DialogDescription>
                  {previewTemplate.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-4">
                <p className="text-sm font-medium">Workflow Steps</p>
                <ol className="space-y-2">
                  {previewTemplate.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <span>
                        {ACTION_LABELS[step.type] || step.type}
                      </span>
                      {step.delay && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          delay: {Math.round(step.delay / 60000)}m
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    onSelect(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  data-testid="use-playbook-btn"
                >
                  Use This Playbook
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
