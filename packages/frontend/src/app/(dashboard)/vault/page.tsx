"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncryptedNoteEditor } from "@/components/vault/encrypted-note-editor";
import { FileUploader } from "@/components/vault/file-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Key } from "lucide-react";
import { useVaultSecrets, useStoreSecret } from "@/lib/hooks/use-vault";
import { encrypt, toBase64 } from "@/lib/crypto/vault-crypto";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";

export default function VaultPage() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const [profileId, setProfileId] = useState("");
  const [noteKey, setNoteKey] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: secretsData, isLoading: loadingSecrets } = useVaultSecrets(profileId || undefined);
  const storeSecret = useStoreSecret();

  const handleSaveNote = async () => {
    if (!noteKey.trim() || !noteContent.trim() || !profileId.trim()) return;
    try {
      setSaving(true);
      setError(null);

      // Sign a message to derive encryption key
      const { signature } = await signMessage({
        message: new TextEncoder().encode(`ROSMAR Vault Encryption Key`),
      });

      // Encrypt note client-side
      const encrypted = await encrypt(noteContent, signature);
      const encryptedB64 = toBase64(encrypted);

      await storeSecret.mutateAsync({
        profileId,
        key: noteKey,
        encryptedData: encryptedB64,
      });

      setNoteContent("");
      setNoteKey("");
    } catch (err: any) {
      setError(err.message ?? "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vault</h1>
        <p className="text-muted-foreground tracking-tight">
          Encrypted notes and files with client-side encryption
        </p>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <Label htmlFor="profileId" className="shrink-0">Profile ID</Label>
        <Input
          id="profileId"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="Enter profile ID to manage secrets"
        />
      </div>

      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Encrypt & Store Note
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="noteKey">Key</Label>
                  <Input
                    id="noteKey"
                    value={noteKey}
                    onChange={(e) => setNoteKey(e.target.value)}
                    placeholder="e.g., api-key, private-note"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="noteContent">Content</Label>
                  <Textarea
                    id="noteContent"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Sensitive content to encrypt..."
                    rows={5}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  onClick={handleSaveNote}
                  disabled={saving || !noteKey.trim() || !noteContent.trim() || !profileId.trim()}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  Encrypt & Save to Walrus
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Saved Secrets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!profileId ? (
                  <p className="text-muted-foreground tracking-tight">
                    Enter a profile ID to view secrets
                  </p>
                ) : loadingSecrets ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : secretsData?.secrets && secretsData.secrets.length > 0 ? (
                  <div className="space-y-3">
                    {secretsData.secrets.map((s: any) => (
                      <div key={s.key} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium text-sm">{s.key}</p>
                          <p className="text-xs text-muted-foreground">v{s.version}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {s.blobId.slice(0, 12)}...
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground tracking-tight">
                    No encrypted secrets yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <FileUploader />
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground tracking-tight">No encrypted files yet</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
