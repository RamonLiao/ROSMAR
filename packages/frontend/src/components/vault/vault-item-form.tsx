'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lock, Upload } from 'lucide-react';
import { useVaultCrypto } from '@/lib/hooks/use-vault-crypto';
import type { VaultType } from '@/lib/hooks/use-vault';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface VaultItemFormProps {
  mode: VaultType;
  profileId: string;
}

export function VaultItemForm({ mode, profileId }: VaultItemFormProps) {
  const [key, setKey] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { encryptAndStore, signing, isStoring } = useVaultCrypto();

  const busy = signing || isStoring;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!key.trim() || !profileId.trim()) return;
    try {
      setError(null);

      if (mode === 'note') {
        if (!content.trim()) return;
        await encryptAndStore({
          profileId,
          key: key.trim(),
          data: content,
          vaultType: 'note',
        });
        setContent('');
      } else {
        if (!file) return;
        const buffer = await file.arrayBuffer();
        await encryptAndStore({
          profileId,
          key: key.trim(),
          data: buffer,
          vaultType: 'file',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        });
        setFile(null);
      }
      setKey('');
    } catch (err: any) {
      setError(err.message ?? 'Operation failed');
    }
  };

  const isDisabled =
    busy ||
    !key.trim() ||
    !profileId.trim() ||
    (mode === 'note' ? !content.trim() : !file);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === 'note' ? <Lock className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {mode === 'note' ? 'Encrypt & Store Note' : 'Encrypt & Upload File'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`vault-key-${mode}`}>Key</Label>
          <Input
            id={`vault-key-${mode}`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g., api-key, contract-draft"
            disabled={busy}
          />
        </div>

        {mode === 'note' ? (
          <div className="space-y-2">
            <Label htmlFor="vault-note-content">Content</Label>
            <Textarea
              id="vault-note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Sensitive content to encrypt..."
              rows={5}
              disabled={busy}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="vault-file-input">File</Label>
            <Input
              id="vault-file-input"
              type="file"
              onChange={handleFileChange}
              disabled={busy}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={isDisabled} className="w-full">
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : mode === 'note' ? (
            <Lock className="mr-2 h-4 w-4" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {busy
            ? signing
              ? 'Signing...'
              : 'Encrypting...'
            : mode === 'note'
              ? 'Encrypt & Save to Walrus'
              : 'Encrypt & Upload to Walrus'}
        </Button>
      </CardContent>
    </Card>
  );
}
