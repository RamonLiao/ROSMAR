'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VaultItemForm } from '@/components/vault/vault-item-form';
import { VaultItemList } from '@/components/vault/vault-item-list';

export default function VaultPage() {
  const [profileId, setProfileId] = useState('');

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
            <VaultItemForm profileId={profileId} />
            <VaultItemList profileId={profileId} vaultType="note" />
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <VaultItemForm profileId={profileId} />
            <VaultItemList profileId={profileId} vaultType="file" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
