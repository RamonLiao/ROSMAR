"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Clock, Eye, EyeOff, Trash2, Timer, LockKeyhole } from "lucide-react";

interface VaultItem {
  key: string;
  blobId: string;
  version: number;
  sealPolicyId?: string | null;
  expiresAt?: string | null;
  releaseAt?: string | null;
  isReleased?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VaultItemCardProps {
  item: VaultItem;
  onDecrypt?: (key: string) => Promise<string | null>;
  onDelete?: (key: string, version: number) => Promise<void>;
}

export function VaultItemCard({ item, onDecrypt, onDelete }: VaultItemCardProps) {
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showValue, setShowValue] = useState(false);

  const handleDecrypt = async () => {
    if (decryptedValue) {
      setShowValue(!showValue);
      return;
    }
    setIsDecrypting(true);
    try {
      const value = await onDecrypt?.(item.key);
      if (value) {
        setDecryptedValue(value);
        setShowValue(true);
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  // Auto-clear decrypted value after 30 seconds
  useEffect(() => {
    if (!showValue) return;

    const timer = setTimeout(() => {
      setShowValue(false);
      setDecryptedValue(null);
    }, 30_000);

    return () => clearTimeout(timer);
  }, [showValue]);

  const isExpired =
    item.expiresAt && new Date(item.expiresAt) < new Date();
  const isTimeLocked = item.releaseAt && !item.isReleased;
  const isDisabled = !!isExpired || !!isTimeLocked;

  return (
    <Card className={isDisabled ? "opacity-50" : ""}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          {isTimeLocked ? (
            <LockKeyhole className="h-4 w-4 text-orange-500" />
          ) : item.sealPolicyId ? (
            <Lock className="h-4 w-4 text-amber-500" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-sm">{item.key}</p>
            <p className="text-xs text-muted-foreground">
              v{item.version} &middot; {new Date(item.updatedAt).toLocaleDateString()}
            </p>
          </div>
          {isTimeLocked && item.releaseAt && (
            <Badge variant="outline" className="text-xs gap-1 border-orange-300 text-orange-600">
              <Timer className="h-3 w-3" />
              Locked until {new Date(item.releaseAt).toLocaleString()}
            </Badge>
          )}
          {item.releaseAt && item.isReleased && (
            <Badge variant="outline" className="text-xs gap-1 border-green-300 text-green-600">
              Released
            </Badge>
          )}
          {item.expiresAt && (
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? "Expired" : new Date(item.expiresAt).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {showValue && decryptedValue && (
            <code className="rounded bg-muted px-2 py-1 text-xs max-w-[200px] truncate">
              {decryptedValue}
            </code>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDecrypt}
            disabled={isDecrypting || isDisabled}
            title={showValue ? "Hide" : "Decrypt"}
          >
            {showValue ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(item.key, item.version)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
