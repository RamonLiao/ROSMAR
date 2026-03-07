# Vault UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Vault stub components with a unified encrypt/decrypt UI for notes and files, backed by Walrus storage.

**Architecture:** Unified VaultItemForm (note/file) + VaultItemList + VaultItemCard with expand-to-decrypt UX. Shared useVaultCrypto hook encapsulates wallet signing + AES-GCM encrypt/decrypt + API calls. BFF gets new metadata fields (vaultType, fileName, mimeType, fileSize).

**Tech Stack:** Next.js (React), @mysten/dapp-kit, Web Crypto API (AES-GCM-256), TanStack Query, NestJS, Prisma 7, Walrus

**Design doc:** `docs/plans/2026-03-06-vault-ui-redesign.md`

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `packages/bff/prisma/schema.prisma:176-191`

**Step 1: Add new columns to VaultSecret model**

Replace lines 176-191 with:

```prisma
model VaultSecret {
  id           String   @id @default(uuid())
  workspaceId  String   @map("workspace_id")
  profileId    String   @map("profile_id")
  key          String
  walrusBlobId String   @map("walrus_blob_id")
  vaultType    String   @default("note") @map("vault_type")
  fileName     String?  @map("file_name")
  mimeType     String?  @map("mime_type")
  fileSize     Int?     @map("file_size")
  version      Int      @default(1)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  profile   Profile   @relation(fields: [profileId], references: [id])

  @@unique([workspaceId, profileId, key])
  @@map("vault_secrets")
}
```

**Step 2: Run migration**

```bash
cd packages/bff
npx prisma migrate dev --name add-vault-metadata
```

Expected: Migration created and applied. `prisma generate` runs automatically.

**Step 3: Commit**

```bash
git add packages/bff/prisma/
git commit -m "feat(vault): add vaultType, fileName, mimeType, fileSize columns"
```

---

## Task 2: BFF — Update DTOs, Service, Controller

**Files:**
- Modify: `packages/bff/src/vault/vault.controller.ts`
- Modify: `packages/bff/src/vault/vault.service.ts`

**Step 1: Update vault.controller.ts DTOs and add class-validator decorators**

Replace entire file:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsIn, IsNumber } from 'class-validator';
import { VaultService } from './vault.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, RequirePermissions, WRITE, DELETE } from '../auth/guards/rbac.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/auth.service';

export class StoreSecretDto {
  @IsString()
  profileId: string;

  @IsString()
  key: string;

  @IsString()
  encryptedData: string; // base64

  @IsIn(['note', 'file'])
  vaultType: 'note' | 'file';

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class UpdateSecretDto {
  @IsString()
  encryptedData: string; // base64

  @IsInt()
  expectedVersion: number;
}

export class DeleteSecretDto {
  @IsInt()
  expectedVersion: number;
}

@Controller('vault')
@UseGuards(SessionGuard, RbacGuard)
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('secrets')
  @RequirePermissions(WRITE)
  async storeSecret(@User() user: UserPayload, @Body() dto: StoreSecretDto) {
    return this.vaultService.storeSecret(user.workspaceId, user.address, dto);
  }

  @Get('secrets/:profileId/:key')
  async getSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
  ) {
    return this.vaultService.getSecret(user.workspaceId, user.address, profileId, key);
  }

  @Get('secrets/:profileId')
  async listSecrets(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
  ) {
    return this.vaultService.listSecrets(user.workspaceId, user.address, profileId);
  }

  @Put('secrets/:profileId/:key')
  @RequirePermissions(WRITE)
  async updateSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSecretDto,
  ) {
    return this.vaultService.updateSecret(user.workspaceId, user.address, profileId, key, dto);
  }

  @Delete('secrets/:profileId/:key')
  @RequirePermissions(DELETE)
  async deleteSecret(
    @User() user: UserPayload,
    @Param('profileId') profileId: string,
    @Param('key') key: string,
    @Body() dto: DeleteSecretDto,
  ) {
    return this.vaultService.deleteSecret(
      user.workspaceId, user.address, profileId, key, dto.expectedVersion,
    );
  }
}
```

**Step 2: Update vault.service.ts — persist new fields, return metadata**

Replace entire file:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from './walrus.client';

export interface StoreSecretInput {
  profileId: string;
  key: string;
  encryptedData: string;
  vaultType: 'note' | 'file';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface UpdateSecretInput {
  encryptedData: string;
  expectedVersion: number;
}

@Injectable()
export class VaultService {
  constructor(
    private readonly walrusClient: WalrusClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async storeSecret(
    workspaceId: string,
    callerAddress: string,
    dto: StoreSecretInput,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    await this.prisma.vaultSecret.upsert({
      where: {
        workspaceId_profileId_key: {
          workspaceId,
          profileId: dto.profileId,
          key: dto.key,
        },
      },
      create: {
        workspaceId,
        profileId: dto.profileId,
        key: dto.key,
        walrusBlobId: uploadResult.blobId,
        vaultType: dto.vaultType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: 1,
      },
      update: {
        walrusBlobId: uploadResult.blobId,
        vaultType: dto.vaultType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: { increment: 1 },
      },
    });

    return { blobId: uploadResult.blobId, url: uploadResult.url };
  }

  async getSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const secret = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });

    if (!secret) return null;

    const aggregatorUrl = this.configService.get(
      'WALRUS_AGGREGATOR_URL',
      'https://aggregator.walrus-testnet.walrus.space',
    );

    return {
      blobId: secret.walrusBlobId,
      downloadUrl: `${aggregatorUrl}/v1/${secret.walrusBlobId}`,
      version: secret.version,
      vaultType: secret.vaultType,
      fileName: secret.fileName,
      mimeType: secret.mimeType,
      fileSize: secret.fileSize,
    };
  }

  async listSecrets(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const secrets = await this.prisma.vaultSecret.findMany({
      where: { workspaceId, profileId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      secrets: secrets.map((s) => ({
        key: s.key,
        blobId: s.walrusBlobId,
        version: s.version,
        vaultType: s.vaultType,
        fileName: s.fileName,
        mimeType: s.mimeType,
        fileSize: s.fileSize,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  async updateSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
    dto: UpdateSecretInput,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    const updated = await this.prisma.vaultSecret.updateMany({
      where: { workspaceId, profileId, key, version: dto.expectedVersion },
      data: {
        walrusBlobId: uploadResult.blobId,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    return {
      blobId: uploadResult.blobId,
      url: uploadResult.url,
      version: dto.expectedVersion + 1,
    };
  }

  async deleteSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
    expectedVersion: number,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const deleted = await this.prisma.vaultSecret.deleteMany({
      where: { workspaceId, profileId, key, version: expectedVersion },
    });

    if (deleted.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    return { success: true };
  }

  private async verifyAccess(
    workspaceId: string,
    callerAddress: string,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_address: { workspaceId, address: callerAddress } },
    });

    if (!member || (member.permissions & 16) === 0) {
      throw new UnauthorizedException('No access to this vault');
    }
  }
}
```

**Step 3: Verify BFF compiles**

```bash
cd packages/bff
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/bff/src/vault/
git commit -m "feat(vault): add vaultType/fileMeta to DTOs, service, controller"
```

---

## Task 3: Frontend — vault-crypto.ts add encryptBytes

**Files:**
- Modify: `packages/frontend/src/lib/crypto/vault-crypto.ts:41-63`

**Step 1: Add encryptBytes function after existing encrypt()**

Add after line 63 (after `encrypt` function):

```typescript
/**
 * Encrypt raw bytes with AES-GCM.
 * Same as encrypt() but for binary data (files).
 * Returns: salt (16B) || iv (12B) || ciphertext
 */
export async function encryptBytes(
  data: Uint8Array,
  signature: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(signature, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  const result = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_BYTES);
  result.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);
  return result;
}

/**
 * Decrypt to raw bytes (for file downloads).
 * Same as decrypt() but returns Uint8Array instead of string.
 */
export async function decryptBytes(
  data: Uint8Array,
  signature: string,
): Promise<Uint8Array> {
  const salt = data.slice(0, SALT_BYTES);
  const iv = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = data.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(signature, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new Uint8Array(plainBuffer);
}
```

**Step 2: Commit**

```bash
git add packages/frontend/src/lib/crypto/vault-crypto.ts
git commit -m "feat(vault): add encryptBytes/decryptBytes for file support"
```

---

## Task 4: Frontend — Update use-vault.ts hooks + apiClient.delete

**Files:**
- Modify: `packages/frontend/src/lib/hooks/use-vault.ts`
- Modify: `packages/frontend/src/lib/api/client.ts:108-110`

**Step 1: Update apiClient.delete to accept a body**

In `client.ts`, replace the delete method (lines 108-110):

```typescript
async delete<T>(endpoint: string, data?: unknown): Promise<T> {
  return this.request<T>(endpoint, {
    method: 'DELETE',
    body: data ? JSON.stringify(data) : undefined,
  });
}
```

**Step 2: Rewrite use-vault.ts with updated types and new hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export type VaultType = 'note' | 'file';

export interface VaultSecret {
  key: string;
  blobId: string;
  version: number;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecretDetail {
  blobId: string;
  downloadUrl: string;
  version: number;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export function useVaultSecrets(profileId?: string) {
  return useQuery({
    queryKey: ['vault', 'secrets', profileId],
    queryFn: () => apiClient.get<{ secrets: VaultSecret[] }>(`/vault/secrets/${profileId}`),
    enabled: !!profileId,
  });
}

export function useGetSecret(profileId: string, key?: string) {
  return useQuery({
    queryKey: ['vault', 'secrets', profileId, key],
    queryFn: () => apiClient.get<VaultSecretDetail>(`/vault/secrets/${profileId}/${key}`),
    enabled: !!profileId && !!key,
  });
}

export function useStoreSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      profileId: string;
      key: string;
      encryptedData: string;
      vaultType: VaultType;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }) => apiClient.post<{ blobId: string; url: string }>('/vault/secrets', data),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'secrets', profileId] });
    },
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { profileId: string; key: string; expectedVersion: number }) =>
      apiClient.delete<{ success: boolean }>(
        `/vault/secrets/${data.profileId}/${data.key}`,
        { expectedVersion: data.expectedVersion },
      ),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'secrets', profileId] });
    },
  });
}
```

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/hooks/use-vault.ts packages/frontend/src/lib/api/client.ts
git commit -m "feat(vault): update hooks with VaultType, add useDeleteSecret"
```

---

## Task 5: Frontend — useVaultCrypto hook

**Files:**
- Create: `packages/frontend/src/lib/hooks/use-vault-crypto.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useSignPersonalMessage } from '@mysten/dapp-kit';
import { encrypt, decrypt, encryptBytes, decryptBytes, toBase64, fromBase64 } from '@/lib/crypto/vault-crypto';
import { useStoreSecret, useDeleteSecret, VaultType } from './use-vault';
import { apiClient } from '@/lib/api/client';

const SIGN_MESSAGE = new TextEncoder().encode('ROSMAR Vault Encryption Key');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface EncryptAndStoreParams {
  profileId: string;
  key: string;
  data: string | ArrayBuffer;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

interface DecryptResult {
  text?: string;
  bytes?: Uint8Array;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
}

export function useVaultCrypto() {
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const storeSecret = useStoreSecret();
  const deleteSecret = useDeleteSecret();
  const [signing, setSigning] = useState(false);

  const getSignature = useCallback(async () => {
    setSigning(true);
    try {
      const { signature } = await signMessage({ message: SIGN_MESSAGE });
      return signature;
    } finally {
      setSigning(false);
    }
  }, [signMessage]);

  const encryptAndStore = useCallback(
    async (params: EncryptAndStoreParams) => {
      if (params.vaultType === 'file' && params.fileSize && params.fileSize > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      }

      const signature = await getSignature();

      let encrypted: Uint8Array;
      if (typeof params.data === 'string') {
        encrypted = await encrypt(params.data, signature);
      } else {
        encrypted = await encryptBytes(new Uint8Array(params.data), signature);
      }

      return storeSecret.mutateAsync({
        profileId: params.profileId,
        key: params.key,
        encryptedData: toBase64(encrypted),
        vaultType: params.vaultType,
        fileName: params.fileName,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
      });
    },
    [getSignature, storeSecret],
  );

  const decryptSecret = useCallback(
    async (profileId: string, key: string): Promise<DecryptResult> => {
      // 1. Get secret metadata + download URL
      const detail = await apiClient.get<{
        downloadUrl: string;
        vaultType: VaultType;
        fileName?: string;
        mimeType?: string;
      }>(`/vault/secrets/${profileId}/${key}`);

      // 2. Download encrypted blob from Walrus
      const response = await fetch(detail.downloadUrl);
      if (!response.ok) throw new Error('Failed to download encrypted data');
      const encryptedBytes = new Uint8Array(await response.arrayBuffer());

      // 3. Sign to get decryption key
      const signature = await getSignature();

      // 4. Decrypt based on type
      if (detail.vaultType === 'note') {
        const text = await decrypt(encryptedBytes, signature);
        return { text, vaultType: 'note' };
      } else {
        const bytes = await decryptBytes(encryptedBytes, signature);
        return {
          bytes,
          vaultType: 'file',
          fileName: detail.fileName,
          mimeType: detail.mimeType,
        };
      }
    },
    [getSignature],
  );

  const removeSecret = useCallback(
    (profileId: string, key: string, expectedVersion: number) =>
      deleteSecret.mutateAsync({ profileId, key, expectedVersion }),
    [deleteSecret],
  );

  return {
    encryptAndStore,
    decryptSecret,
    removeSecret,
    signing,
    isStoring: storeSecret.isPending,
    isDeleting: deleteSecret.isPending,
  };
}
```

**Step 2: Commit**

```bash
git add packages/frontend/src/lib/hooks/use-vault-crypto.ts
git commit -m "feat(vault): add useVaultCrypto hook (encrypt/decrypt/delete)"
```

---

## Task 6: Frontend — VaultItemForm component

**Files:**
- Create: `packages/frontend/src/components/vault/vault-item-form.tsx`

**Step 1: Create the component**

```tsx
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
```

**Step 2: Commit**

```bash
git add packages/frontend/src/components/vault/vault-item-form.tsx
git commit -m "feat(vault): VaultItemForm component (note + file modes)"
```

---

## Task 7: Frontend — VaultItemCard component

**Files:**
- Create: `packages/frontend/src/components/vault/vault-item-card.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lock,
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
    const blob = new Blob([decryptedBytes.bytes], {
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

      {/* Decrypted content */}
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
```

**Step 2: Commit**

```bash
git add packages/frontend/src/components/vault/vault-item-card.tsx
git commit -m "feat(vault): VaultItemCard with decrypt/copy/download/delete"
```

---

## Task 8: Frontend — VaultItemList component

**Files:**
- Create: `packages/frontend/src/components/vault/vault-item-list.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Key, FileIcon, Loader2 } from 'lucide-react';
import { useVaultSecrets, type VaultType } from '@/lib/hooks/use-vault';
import { VaultItemCard } from './vault-item-card';

interface VaultItemListProps {
  profileId: string;
  vaultType: VaultType;
}

export function VaultItemList({ profileId, vaultType }: VaultItemListProps) {
  const { data, isLoading } = useVaultSecrets(profileId || undefined);

  const filtered = data?.secrets?.filter((s) => s.vaultType === vaultType) ?? [];
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
              <VaultItemCard key={s.key} secret={s} profileId={profileId} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/src/components/vault/vault-item-list.tsx
git commit -m "feat(vault): VaultItemList with type filtering and loading skeleton"
```

---

## Task 9: Frontend — Rewrite VaultPage + delete stubs

**Files:**
- Rewrite: `packages/frontend/src/app/(dashboard)/vault/page.tsx`
- Delete: `packages/frontend/src/components/vault/encrypted-note-editor.tsx`
- Delete: `packages/frontend/src/components/vault/file-uploader.tsx`

**Step 1: Rewrite page.tsx as pure composition**

```tsx
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
            <VaultItemForm mode="note" profileId={profileId} />
            <VaultItemList profileId={profileId} vaultType="note" />
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <VaultItemForm mode="file" profileId={profileId} />
            <VaultItemList profileId={profileId} vaultType="file" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Delete stub files**

```bash
rm packages/frontend/src/components/vault/encrypted-note-editor.tsx
rm packages/frontend/src/components/vault/file-uploader.tsx
```

**Step 3: Verify no broken imports**

```bash
cd packages/frontend
npx tsc --noEmit
```

Expected: No errors. (If E2E specs import old stubs, update those too.)

**Step 4: Commit**

```bash
git add -A packages/frontend/src/components/vault/ packages/frontend/src/app/\(dashboard\)/vault/page.tsx
git commit -m "feat(vault): rewrite VaultPage, delete stubs, wire up new components"
```

---

## Task 10: Verify — Build + Smoke Test

**Step 1: Build frontend**

```bash
cd packages/frontend
npx tsc --noEmit
pnpm build
```

Expected: No errors.

**Step 2: Build BFF**

```bash
cd packages/bff
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Run existing tests**

```bash
cd packages/frontend
pnpm test:run
```

Expected: All vitest tests pass. (Playwright E2E skipped unless servers running.)

**Step 4: Manual smoke test (if servers running)**

1. Navigate to `/vault`
2. Enter a profile ID
3. Notes tab: enter key + content → click "Encrypt & Save" → verify it appears in list
4. Click "Decrypt" on saved note → verify content displays
5. Click "Copy" → paste to verify
6. Click "Hide" → verify content cleared
7. Files tab: select file under 5MB → click "Encrypt & Upload" → verify in list
8. Try file over 5MB → verify error message
9. Click "Delete" → click "Confirm?" → verify removed from list

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(vault): complete Vault UI redesign with encrypt/decrypt/file support"
```
