"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Fingerprint, CheckCircle2, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkspace, useUpdateWorkspace } from "@/lib/hooks/use-workspaces";
import { usePasskeyRegisterOptions, usePasskeyRegisterVerify } from "@/lib/hooks/use-passkey";
import { useAiConfig, useUpdateAiConfig } from "@/lib/hooks/use-ai-settings";
import { startRegistration } from "@simplewebauthn/browser";

function AiConfigSection() {
  const { data: aiConfig, isLoading: aiLoading } = useAiConfig();
  const updateAiConfig = useUpdateAiConfig();
  const [apiKey, setApiKey] = useState("");

  const quotaPercent = aiConfig
    ? Math.min(100, (aiConfig.usedQuotaUsd / aiConfig.monthlyQuotaUsd) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {aiLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading AI config...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable AI Features</Label>
                <p className="text-sm text-muted-foreground">
                  Allow AI agents to process data in this workspace
                </p>
              </div>
              <Button
                variant={aiConfig?.isEnabled ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateAiConfig.mutate({ isEnabled: !aiConfig?.isEnabled })
                }
              >
                {aiConfig?.isEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={aiConfig?.provider ?? "anthropic"}
                onValueChange={(value) =>
                  updateAiConfig.mutate({ provider: value })
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-api-key">API Key (BYOK - optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="ai-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    aiConfig?.hasApiKey
                      ? "Key saved - enter new key to replace"
                      : "Use platform key (leave empty)"
                  }
                />
                <Button
                  variant="outline"
                  disabled={!apiKey.trim() || updateAiConfig.isPending}
                  onClick={() => {
                    updateAiConfig.mutate({ apiKey: apiKey.trim() });
                    setApiKey("");
                  }}
                >
                  {updateAiConfig.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bring your own API key for unlimited usage, or use the platform
                key within your monthly quota.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label>Monthly Usage</Label>
                <span className="text-muted-foreground">
                  ${aiConfig?.usedQuotaUsd.toFixed(2)} / $
                  {aiConfig?.monthlyQuotaUsd.toFixed(2)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    quotaPercent > 90
                      ? "bg-destructive"
                      : quotaPercent > 70
                        ? "bg-yellow-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>

            {updateAiConfig.isSuccess && (
              <p className="text-sm text-green-600">AI config saved.</p>
            )}
            {updateAiConfig.isError && (
              <p className="text-sm text-destructive">
                Failed: {(updateAiConfig.error as Error).message}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkspaceSettingsPage() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const { data: workspace, isLoading } = useWorkspace(activeWorkspace?.id ?? "");
  const updateWorkspace = useUpdateWorkspace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Passkey registration
  const passkeyRegOptions = usePasskeyRegisterOptions();
  const passkeyRegVerify = usePasskeyRegisterVerify();
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySuccess, setPasskeySuccess] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const handlePasskeyRegister = async () => {
    try {
      setPasskeyLoading(true);
      setPasskeyError(null);
      setPasskeySuccess(false);
      const options = await passkeyRegOptions.mutateAsync();
      const credential = await startRegistration({ optionsJSON: options });
      const result = await passkeyRegVerify.mutateAsync(credential);
      if (result.verified) {
        setPasskeySuccess(true);
      }
    } catch (err: any) {
      setPasskeyError(err.message ?? "Failed to register passkey");
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Sync form state when workspace data loads
  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description ?? "");
    }
  }, [workspace]);

  const handleSave = () => {
    if (!activeWorkspace) return;
    updateWorkspace.mutate({
      id: activeWorkspace.id,
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const isDirty =
    workspace &&
    (name.trim() !== workspace.name ||
      (description.trim() || "") !== (workspace.description ?? ""));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground tracking-tight">
          Manage your workspace configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workspace...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this workspace..."
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={!isDirty || updateWorkspace.isPending || !name.trim()}
              >
                {updateWorkspace.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>

              {updateWorkspace.isSuccess && (
                <p className="text-sm text-green-600">Saved successfully.</p>
              )}
              {updateWorkspace.isError && (
                <p className="text-sm text-destructive">
                  Failed to save: {(updateWorkspace.error as Error).message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passkey Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Register a passkey to sign in with biometrics (Face ID, Touch ID, Windows Hello) instead of connecting a wallet.
          </p>
          {passkeySuccess ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Passkey registered successfully
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handlePasskeyRegister}
              disabled={passkeyLoading}
            >
              {passkeyLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
              )}
              Register Passkey
            </Button>
          )}
          {passkeyError && (
            <p className="text-sm text-destructive">{passkeyError}</p>
          )}
        </CardContent>
      </Card>

      <AiConfigSection />

      <Card>
        <CardHeader>
          <CardTitle>Engagement Score Weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>NFT Transfers</Label>
              <Input type="number" defaultValue="10" />
            </div>
            <div className="space-y-2">
              <Label>Token Swaps</Label>
              <Input type="number" defaultValue="5" />
            </div>
            <div className="space-y-2">
              <Label>Staking</Label>
              <Input type="number" defaultValue="15" />
            </div>
            <div className="space-y-2">
              <Label>Contract Interactions</Label>
              <Input type="number" defaultValue="8" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
