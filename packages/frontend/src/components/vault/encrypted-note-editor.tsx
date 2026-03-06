"use client";

import { useState } from "react";
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
import { Lock, Save } from "lucide-react";
import { useVaultCrypto } from "@/lib/hooks/use-vault-crypto";

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
  const [policyType, setPolicyType] = useState<string>("workspace");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { encryptAndStore, isInitializing } = useVaultCrypto();

  // In production, different policy types map to different on-chain policy objects.
  // For now we use the provided default or a placeholder.
  const policyObjectId = defaultPolicyId ?? "0x0";

  const handleSave = async () => {
    if (!profileId) {
      setError("No profile selected");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const plaintext = new TextEncoder().encode(
        JSON.stringify({ title, content }),
      );

      await encryptAndStore({
        profileId,
        key: `note:${title}`,
        plaintext,
        sealPolicyId: policyObjectId,
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

        <div className="space-y-2">
          <Label htmlFor="policy-type">Access Policy</Label>
          <Select value={policyType} onValueChange={setPolicyType}>
            <SelectTrigger id="policy-type">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">Workspace Members</SelectItem>
              <SelectItem value="address">Specific Addresses</SelectItem>
              <SelectItem value="role">Role-Based</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
