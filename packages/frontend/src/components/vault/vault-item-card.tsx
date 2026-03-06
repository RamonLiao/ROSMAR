"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Copy, Trash2, FileText, File } from "lucide-react";
import { useVaultCrypto } from "@/lib/hooks/use-vault-crypto";
import type { VaultSecretSummary } from "@/lib/hooks/use-vault";

interface VaultItemCardProps {
  secret: VaultSecretSummary;
  profileId: string;
  onDeleted?: () => void;
}

export function VaultItemCard({
  secret,
  profileId,
  onDeleted,
}: VaultItemCardProps) {
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { decryptSecret, removeSecret } = useVaultCrypto();

  const isNote = secret.key.startsWith("note:");
  const isFile = secret.key.startsWith("file:");
  const displayName = secret.key.replace(/^(note|file):/, "");

  const handleDecrypt = async () => {
    if (decryptedText !== null) {
      // Toggle visibility off
      setDecryptedText(null);
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      const decrypted = await decryptSecret({
        profileId,
        key: secret.key,
        sealPolicyId: secret.sealPolicyId ?? "",
      });

      const text = new TextDecoder().decode(decrypted);

      if (isNote) {
        try {
          const parsed = JSON.parse(text);
          setDecryptedText(parsed.content ?? text);
        } catch {
          setDecryptedText(text);
        }
      } else {
        setDecryptedText(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleCopy = async () => {
    if (decryptedText) {
      await navigator.clipboard.writeText(decryptedText);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeSecret({
        profileId,
        key: secret.key,
        expectedVersion: secret.version,
      });
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="mt-0.5">
          {isNote ? (
            <FileText className="h-4 w-4 text-muted-foreground" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            v{secret.version} | {new Date(secret.updatedAt).toLocaleDateString()}
          </p>

          {decryptedText !== null && (
            <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs max-h-40 overflow-auto">
              {decryptedText}
            </pre>
          )}

          {error && (
            <p className="mt-1 text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDecrypt}
            disabled={isDecrypting}
            title={decryptedText !== null ? "Hide" : "Decrypt"}
          >
            {decryptedText !== null ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          {decryptedText !== null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopy}
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
