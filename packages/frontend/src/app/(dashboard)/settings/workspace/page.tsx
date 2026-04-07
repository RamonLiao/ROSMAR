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
import { Loader2, Save, Fingerprint, CheckCircle2, Bot, Fuel, Library, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkspace, useUpdateWorkspace } from "@/lib/hooks/use-workspaces";
import { usePasskeyRegisterOptions, usePasskeyRegisterVerify } from "@/lib/hooks/use-passkey";
import { useAiConfig, useUpdateAiConfig } from "@/lib/hooks/use-ai-settings";
import { useGasSettings, useUpdateGasSettings } from "@/lib/hooks/use-gas-settings";
import {
  useCollectionWatchlist,
  useSetCollectionWatchlist,
  type CollectionEntry,
} from "@/lib/hooks/use-collection-watchlist";
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

const CHAIN_OPTIONS = ["sui", "evm", "solana"] as const;

function CollectionWatchlistSection() {
  const { data: collections = [], isLoading } = useCollectionWatchlist();
  const setWatchlist = useSetCollectionWatchlist();

  const [localList, setLocalList] = useState<CollectionEntry[]>([]);
  const [synced, setSynced] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newChain, setNewChain] = useState<CollectionEntry["chain"]>("sui");

  // Sync from server once
  useEffect(() => {
    if (collections.length > 0 || (!isLoading && !synced)) {
      queueMicrotask(() => {
        setLocalList(collections);
        setSynced(true);
      });
    }
  }, [collections, isLoading, synced]);

  const handleAdd = () => {
    if (!newName.trim() || !newAddress.trim()) return;
    const entry: CollectionEntry = {
      name: newName.trim(),
      contractAddress: newAddress.trim(),
      chain: newChain,
    };
    const updated = [...localList, entry];
    setLocalList(updated);
    setNewName("");
    setNewAddress("");
    setNewChain("sui");
    setAdding(false);
    setWatchlist.mutate(updated);
  };

  const handleRemove = (index: number) => {
    const updated = localList.filter((_, i) => i !== index);
    setLocalList(updated);
    setWatchlist.mutate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Collection Watchlist
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="mr-1 h-3 w-3" />
            Add Collection
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          NFT collections tracked by this workspace. Used as options for campaign mint triggers.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading watchlist...
          </div>
        ) : localList.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground py-2">
            No collections added yet.
          </p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Contract Address</th>
                  <th className="px-3 py-2 text-left font-medium">Chain</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {localList.map((entry, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">{entry.name}</td>
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]">
                      {entry.contractAddress}
                    </td>
                    <td className="px-3 py-2 capitalize">{entry.chain}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {adding && (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sui Punks"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Contract Address</Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chain</Label>
              <Select value={newChain} onValueChange={(v) => setNewChain(v as CollectionEntry["chain"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAIN_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 md:col-span-4">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || !newAddress.trim() || setWatchlist.isPending}
              >
                {setWatchlist.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-3 w-3" />
                )}
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {setWatchlist.isError && (
          <p className="text-sm text-destructive">
            Failed to save: {(setWatchlist.error as Error).message}
          </p>
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

  // Gas station settings
  const { settings: gasSettings, isLoading: gasLoading } = useGasSettings();
  const updateGasConfig = useUpdateGasSettings();

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
    } catch (err: unknown) {
      setPasskeyError(err instanceof Error ? err.message : "Failed to register passkey");
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
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Gas Station
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically sponsor gas fees for users with low SUI balance. Uses Enoki sponsored transactions.
          </p>

          <div className="flex items-center justify-between">
            <Label htmlFor="gas-enabled">Enable Gas Sponsorship</Label>
            <Button
              id="gas-enabled"
              variant={gasSettings.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => updateGasConfig.mutate({ enabled: !gasSettings.enabled })}
            >
              {gasSettings.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gas-threshold">Minimum SUI Balance Threshold</Label>
              <Input
                id="gas-threshold"
                type="number"
                step="0.01"
                min="0"
                value={gasSettings.thresholdSui}
                onChange={(e) => {
                  const sui = parseFloat(e.target.value) || 0;
                  updateGasConfig.mutate({
                    thresholdMist: String(Math.round(sui * 1_000_000_000)),
                  });
                }}
                disabled={!gasSettings.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Wallets below this balance will receive sponsored transactions (default: 0.1 SUI)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gas-daily-limit">Daily Sponsored TX Limit</Label>
              <Input
                id="gas-daily-limit"
                type="number"
                min="0"
                value={gasSettings.dailyLimit}
                onChange={(e) =>
                  updateGasConfig.mutate({ dailyLimit: parseInt(e.target.value) || 0 })
                }
                disabled={!gasSettings.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Maximum sponsored transactions per day for this workspace
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <CollectionWatchlistSection />

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
