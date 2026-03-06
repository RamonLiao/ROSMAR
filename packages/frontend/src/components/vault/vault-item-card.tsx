'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Unlock,
  Copy,
  EyeOff,
  Trash2,
  Download,
  FileText,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { useVaultCrypto } from '@/lib/hooks/use-vault-crypto';
import type { VaultSecret } from '@/lib/hooks/use-vault';

interface VaultItemCardProps {
  secret: VaultSecret;
  profileId: string;
}

export function VaultItemCard({ secret, profileId }: VaultItemCardProps) {
  const { decryptSecret, removeSecret, signing, isDeleting } = useVaultCrypto();
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decryptedBytes, setDecryptedBytes] = useState<{
    bytes: Uint8Array;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpanded = decrypted !== null || decryptedBytes !== null;

  const handleDecrypt = async () => {
    try {
      setError(null);
      setDecrypting(true);
      const result = await decryptSecret(profileId, secret.key);
      if (result.vaultType === 'note' && result.text) {
        setDecrypted(result.text);
      } else if (result.bytes) {
        setDecryptedBytes({
          bytes: result.bytes,
          fileName: result.fileName,
          mimeType: result.mimeType,
        });
      }
    } catch (err: any) {
      setError(err.message ?? 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  const handleHide = () => {
    setDecrypted(null);
    setDecryptedBytes(null);
    setError(null);
  };

  const handleCopy = async () => {
    if (decrypted) {
      await navigator.clipboard.writeText(decrypted);
    }
  };

  const handleDownload = () => {
    if (!decryptedBytes) return;
    const blob = new Blob([decryptedBytes.bytes as BlobPart], {
      type: decryptedBytes.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decryptedBytes.fileName || secret.key;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setError(null);
      await removeSecret(profileId, secret.key, secret.version);
    } catch (err: any) {
      setError(err.message ?? 'Delete failed');
      setConfirmDelete(false);
    }
  };

  const icon = secret.vaultType === 'file' ? (
    <FileIcon className="h-4 w-4 text-muted-foreground" />
  ) : (
    <FileText className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <div className="rounded-lg border p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="font-medium text-sm truncate">{secret.key}</span>
          <Badge variant="outline" className="text-xs shrink-0">v{secret.version}</Badge>
          {secret.fileName && (
            <span className="text-xs text-muted-foreground truncate">{secret.fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecrypt}
              disabled={decrypting || signing}
            >
              {decrypting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              <span className="ml-1 text-xs">Decrypt</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Decrypted note content */}
      {decrypted !== null && (
        <div className="space-y-2">
          <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
            {decrypted}
          </pre>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={handleHide}>
              <EyeOff className="h-3 w-3 mr-1" /> Hide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className={confirmDelete ? 'text-destructive' : ''}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              {confirmDelete ? 'Confirm?' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Decrypted file content */}
      {decryptedBytes !== null && (
        <div className="space-y-2">
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="font-medium">{decryptedBytes.fileName || secret.key}</p>
            {secret.fileSize && (
              <p className="text-muted-foreground">
                {(secret.fileSize / 1024).toFixed(1)} KB — {decryptedBytes.mimeType || 'unknown type'}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-3 w-3 mr-1" /> Download
            </Button>
            <Button variant="ghost" size="sm" onClick={handleHide}>
              <EyeOff className="h-3 w-3 mr-1" /> Hide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className={confirmDelete ? 'text-destructive' : ''}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              {confirmDelete ? 'Confirm?' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
