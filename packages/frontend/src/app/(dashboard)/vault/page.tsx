'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VaultItemForm } from '@/components/vault/vault-item-form';
import { VaultItemList } from '@/components/vault/vault-item-list';
import { useVaultCrypto } from '@/lib/hooks/use-vault-crypto';
import { useCreatePolicy } from '@/lib/hooks/use-create-policy';
import type { PolicyValue } from '@/components/vault/policy-selector';
import { useQueryClient } from '@tanstack/react-query';

export default function VaultPage() {
  const [profileId, setProfileId] = useState('');
  const { encryptAndStore, decryptSecret, removeSecret, isInitializing } = useVaultCrypto();
  const { createPolicy } = useCreatePolicy();
  const queryClient = useQueryClient();

  const handleSubmit = async (data: {
    key: string;
    content: string;
    policy: PolicyValue;
    expiresAt: string | null;
  }) => {
    if (!profileId) return;

    // 1. Create Seal policy on-chain
    const { policyId } = await createPolicy({
      name: `vault-${data.key}`,
      ruleType: data.policy.ruleType,
      allowedAddresses: data.policy.allowedAddresses,
      minRoleLevel: data.policy.minRoleLevel,
      expiresAtMs: data.expiresAt
        ? String(new Date(data.expiresAt).getTime())
        : '0',
    });

    // 2. Encrypt with Seal and store via BFF → Walrus
    const plaintext = new TextEncoder().encode(data.content);
    await encryptAndStore({
      profileId,
      key: data.key,
      plaintext,
      sealPolicyId: policyId,
    });

    queryClient.invalidateQueries({ queryKey: ['vault-secrets', profileId] });
  };

  const handleDecrypt = async (key: string, sealPolicyId?: string | null): Promise<string | null> => {
    if (!profileId || !sealPolicyId) return null;
    const decrypted = await decryptSecret({ profileId, key, sealPolicyId });
    return new TextDecoder().decode(decrypted);
  };

  const handleDelete = async (key: string, version: number) => {
    if (!profileId) return;
    await removeSecret({ profileId, key, expectedVersion: version });
    queryClient.invalidateQueries({ queryKey: ['vault-secrets', profileId] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vault</h1>
        <p className="text-muted-foreground tracking-tight">
          Encrypted notes and files with Seal threshold encryption
        </p>
      </div>

      {isInitializing && (
        <p className="text-sm text-amber-600">Initializing Seal session — please sign the wallet prompt...</p>
      )}

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
            <VaultItemForm profileId={profileId} onSubmit={handleSubmit} />
            <VaultItemList
              profileId={profileId}
              vaultType="note"
              onDecrypt={handleDecrypt}
              onDelete={handleDelete}
            />
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <VaultItemForm profileId={profileId} onSubmit={handleSubmit} />
            <VaultItemList
              profileId={profileId}
              vaultType="file"
              onDecrypt={handleDecrypt}
              onDelete={handleDelete}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
