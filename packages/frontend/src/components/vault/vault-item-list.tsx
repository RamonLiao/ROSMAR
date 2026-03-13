'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Key, File as FileIcon } from 'lucide-react';
import { useVaultSecrets } from '@/lib/hooks/use-vault';
import { VaultItemCard } from './vault-item-card';

interface VaultItemListProps {
  profileId: string;
  vaultType: 'note' | 'file';
  onDecrypt?: (key: string, sealPolicyId?: string | null) => Promise<string | null>;
  onDelete?: (key: string, version: number) => Promise<void>;
}

export function VaultItemList({ profileId, vaultType, onDecrypt, onDelete }: VaultItemListProps) {
  const { data: secrets, isLoading } = useVaultSecrets(profileId || undefined);

  const filtered = secrets ?? [];
  const icon = vaultType === 'note' ? <Key className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />;
  const title = vaultType === 'note' ? 'Saved Secrets' : 'Uploaded Files';
  const emptyText = vaultType === 'note' ? 'No encrypted notes yet' : 'No encrypted files yet';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!profileId ? (
          <p className="text-sm text-muted-foreground">Enter a profile ID to view secrets</p>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((s) => (
              <VaultItemCard
                key={s.key}
                item={{
                  key: s.key,
                  blobId: s.blobId,
                  version: s.version,
                  sealPolicyId: s.sealPolicyId,
                  createdAt: s.createdAt,
                  updatedAt: s.updatedAt,
                }}
                onDecrypt={onDecrypt ? (k) => onDecrypt(k, s.sealPolicyId) : undefined}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
