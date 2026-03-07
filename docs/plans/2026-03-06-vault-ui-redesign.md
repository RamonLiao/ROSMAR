# Vault UI Redesign — Design Document

Date: 2026-03-06

## Goal

Replace EncryptedNoteEditor and FileUploader stubs with a unified, functional Vault UI that supports:
- Encrypt & store notes (already working, refactor into components)
- Encrypt & store files (new, 5MB limit)
- Decrypt & display notes (new)
- Decrypt & download files (new)
- Delete secrets (new)

## Architecture

```
VaultPage (~50 lines — layout, tabs, profileId state)
├── Notes Tab
│   ├── VaultItemForm mode="note"
│   └── VaultItemList vaultType="note"
│       └── VaultItemCard (click to decrypt, show text, copy, hide, delete)
├── Files Tab
│   ├── VaultItemForm mode="file"
│   └── VaultItemList vaultType="file"
│       └── VaultItemCard (click to decrypt, download, hide, delete)
└── useVaultCrypto() hook (sign + encrypt/decrypt + API calls)
```

## Components

### VaultPage
- Layout: header, profileId input, Tabs (notes/files)
- Passes `profileId` down to children
- No crypto logic — pure composition

### VaultItemForm
- Props: `mode: "note" | "file"`, `profileId: string`
- Note mode: Key input + Textarea
- File mode: Key input + File input (5MB limit check) + file metadata display
- Calls `useVaultCrypto().encryptAndStore()`
- Shows loading/error states
- Resets form on success

### VaultItemList
- Props: `profileId: string`, `vaultType: "note" | "file"`
- Uses `useVaultSecrets(profileId)` filtered by vaultType
- Renders VaultItemCard[] or empty state
- Loading skeleton

### VaultItemCard
- Props: `secret: VaultSecret`, `profileId: string`
- Collapsed: key name, version badge, blobId preview, [Decrypt] button
- Expanded (after decrypt):
  - Note: decrypted text in monospace block + [Copy] [Hide] [Delete]
  - File: file info (name, size, type) + [Download] [Hide] [Delete]
- Decrypt triggers `useVaultCrypto().decryptSecret()`
- Hide clears decrypted content from memory (security)
- Delete calls `useDeleteSecret()` with confirmation dialog

### useVaultCrypto() hook
- `encryptAndStore({ profileId, key, data: string | ArrayBuffer, vaultType, fileMeta? })`
  1. signMessage("ROSMAR Vault Encryption Key")
  2. For string: encrypt(text, signature) — existing vault-crypto.ts
  3. For ArrayBuffer: encryptBytes(bytes, signature) — new function
  4. toBase64(encrypted)
  5. POST /vault/secrets via useStoreSecret mutation
- `decryptSecret(profileId, key)`
  1. GET /vault/secrets/:profileId/:key → { downloadUrl }
  2. fetch(downloadUrl) → encrypted bytes
  3. signMessage("ROSMAR Vault Encryption Key")
  4. decrypt(bytes, signature)
  5. Return decrypted string or Blob

## Data Flow

### Write Path (Note & File unified)
```
User fills VaultItemForm
  → encryptAndStore({ profileId, key, data, vaultType, fileMeta? })
  → signMessage → encrypt/encryptBytes → toBase64
  → POST /vault/secrets { profileId, key, encryptedData, vaultType, fileName?, mimeType?, fileSize? }
  → BFF: upload to Walrus → store metadata in DB
  → Response: { blobId, url }
  → Invalidate query cache → list refreshes
```

### Read Path (Decrypt on demand)
```
User clicks [Decrypt] on VaultItemCard
  → decryptSecret(profileId, key)
  → GET /vault/secrets/:profileId/:key → { downloadUrl, vaultType, fileName, mimeType }
  → fetch(downloadUrl) → encrypted Uint8Array
  → signMessage → decrypt
  → Note: display text in card
  → File: create Blob → trigger download with original fileName/mimeType
```

## Backend Changes

### StoreSecretDto — add fields
```typescript
vaultType: 'note' | 'file';  // required
fileName?: string;
mimeType?: string;
fileSize?: number;
```

### Prisma Migration — VaultSecret new columns
```prisma
vaultType  String   @default("note") @map("vault_type")
fileName   String?  @map("file_name")
mimeType   String?  @map("mime_type")
fileSize   Int?     @map("file_size")
```

### GetSecret response — add metadata
Return `vaultType`, `fileName`, `mimeType`, `fileSize` alongside existing `blobId`, `downloadUrl`, `version`.

### ListSecrets response — add metadata
Include `vaultType`, `fileName`, `mimeType`, `fileSize` per item so VaultItemList can filter and display without extra API calls.

## Frontend Changes

### vault-crypto.ts — add encryptBytes
```typescript
export async function encryptBytes(data: Uint8Array, signature: string): Promise<Uint8Array>
```
Same as encrypt() but skips TextEncoder — takes raw bytes directly.
Future chunked upload only needs to replace this function's internals.

### use-vault.ts — add hooks
- `useDeleteSecret()` — DELETE /vault/secrets/:profileId/:key with cache invalidation
- Update `VaultSecret` interface to include vaultType, fileName, mimeType, fileSize

## File Upload Constraints
- Frontend hard limit: 5MB (`file.size > 5_242_880` → toast error before encrypt)
- Extensibility: `encryptAndStore()` accepts `string | ArrayBuffer` — future chunked upload replaces internal implementation without changing component API

## Files to Delete
- `packages/frontend/src/components/vault/encrypted-note-editor.tsx`
- `packages/frontend/src/components/vault/file-uploader.tsx`

## Files to Create
- `packages/frontend/src/components/vault/vault-item-form.tsx`
- `packages/frontend/src/components/vault/vault-item-list.tsx`
- `packages/frontend/src/components/vault/vault-item-card.tsx`
- `packages/frontend/src/lib/hooks/use-vault-crypto.ts`

## Files to Modify
- `packages/frontend/src/app/(dashboard)/vault/page.tsx` — rewrite to composition only
- `packages/frontend/src/lib/crypto/vault-crypto.ts` — add encryptBytes
- `packages/frontend/src/lib/hooks/use-vault.ts` — add useDeleteSecret, update VaultSecret type
- `packages/bff/src/vault/vault.controller.ts` — update DTOs
- `packages/bff/src/vault/vault.service.ts` — persist new fields
- `packages/bff/prisma/schema.prisma` — add columns to VaultSecret
