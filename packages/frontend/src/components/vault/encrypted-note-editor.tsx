"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Save } from "lucide-react";
import { useVaultCrypto } from "@/lib/hooks/use-vault-crypto";
import { useCreatePolicy } from "@/lib/hooks/use-create-policy";
import { PolicySelector, type PolicyValue } from "./policy-selector";

interface EncryptedNoteEditorProps {
  profileId?: string;
  sealPolicyId?: string;
  onSaved?: () => void;
}

export function EncryptedNoteEditor({
  profileId,
  sealPolicyId: defaultPolicyId,
  onSaved,
}: EncryptedNoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [policy, setPolicy] = useState<PolicyValue>({ ruleType: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { encryptAndStore, isInitializing } = useVaultCrypto();
  const { createPolicy } = useCreatePolicy();

  const handleSave = async () => {
    if (!profileId) {
      setError("No profile selected");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { policyId } = defaultPolicyId
        ? { policyId: defaultPolicyId }
        : await createPolicy({
            name: `note:${title}`,
            ruleType: policy.ruleType,
            allowedAddresses: policy.allowedAddresses,
            minRoleLevel: policy.minRoleLevel,
            expiresAtMs: policy.expiresAtMs
              ? String(policy.expiresAtMs)
              : undefined,
          });

      const plaintext = new TextEncoder().encode(
        JSON.stringify({ title, content }),
      );

      await encryptAndStore({
        profileId,
        key: `note:${title}`,
        plaintext,
        sealPolicyId: policyId,
      });

      setTitle("");
      setContent("");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled = !title || !content || isSaving || isInitializing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Encrypted Note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            placeholder="Write your encrypted note here..."
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {!defaultPolicyId && (
          <PolicySelector value={policy} onChange={setPolicy} />
        )}

        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            <Lock className="mr-2 inline h-3 w-3" />
            This note will be encrypted client-side using Seal before uploading.
            Only authorized users matching the access policy can decrypt it.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button onClick={handleSave} disabled={isDisabled}>
          <Save className="mr-2 h-4 w-4" />
          {isInitializing
            ? "Initializing session..."
            : isSaving
              ? "Encrypting..."
              : "Save Encrypted Note"}
        </Button>
      </CardContent>
    </Card>
  );
}
