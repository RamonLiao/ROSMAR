"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PolicySelector, type PolicyValue } from "./policy-selector";
import { Lock, Save } from "lucide-react";

interface VaultItemFormProps {
  profileId?: string;
  onSubmit?: (data: {
    key: string;
    content: string;
    policy: PolicyValue;
    expiresAt: string | null;
  }) => Promise<void>;
}

export function VaultItemForm({ profileId, onSubmit }: VaultItemFormProps) {
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [policy, setPolicy] = useState<PolicyValue>({ ruleType: 0 });
  const [expiresAt, setExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!key || !content) return;
    setIsSaving(true);
    try {
      await onSubmit?.({
        key,
        content,
        policy,
        expiresAt: expiresAt || null,
      });
      setKey("");
      setContent("");
      setExpiresAt("");
      setPolicy({ ruleType: 0 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          New Vault Item
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vault-key">Key</Label>
          <Input
            id="vault-key"
            placeholder="e.g. api_key, wallet_seed..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vault-content">Secret Content</Label>
          <Textarea
            id="vault-content"
            placeholder="Enter secret value..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <PolicySelector value={policy} onChange={setPolicy} />

        <div className="space-y-2">
          <Label htmlFor="vault-expires">
            Expires At{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="vault-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!key || !content || isSaving}
          className="w-full"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Encrypting..." : "Encrypt & Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
