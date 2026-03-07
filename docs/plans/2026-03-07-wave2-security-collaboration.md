# Wave 2: Security & Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add granular per-item ACL with time-lock to Vault, and build Deal Room with encrypted document sharing.

**Architecture:** Vault already has Seal SDK integration (P2-6). P2-7 adds BFF-level policy enforcement (verify caller matches policy rules), `expiresAt` field with archival cron, and a policy selector in the frontend. P2-8 adds `DealDocument` model, BFF endpoints for deal document CRUD, and a Documents tab in deal detail page — reusing Seal encryption from vault.

**Tech Stack:** Prisma 7 (migration), NestJS 11 (BFF), Move (crm_vault::policy already done), React + Seal SDK (frontend), Walrus (blob storage)

**Dependency chain:** P2-7 (Vault ACL) -> P2-8 (Deal Room, builds on ACL patterns)

---

## Task 1 (P2-7): Prisma Migration — VaultSecret expiresAt + VaultAccessLog

**Files:**
- Modify: `packages/bff/prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Context:** Need `expiresAt` for time-lock and `VaultAccessLog` for audit trail.

**Step 1: Add fields and model to schema.prisma**

Add `expiresAt` to VaultSecret:

```prisma
model VaultSecret {
  // ... existing fields ...
  expiresAt    DateTime? @map("expires_at")
  // ... rest unchanged ...
}
```

Add new VaultAccessLog model:

```prisma
model VaultAccessLog {
  id          String   @id @default(uuid())
  workspaceId String   @map("workspace_id")
  secretId    String   @map("secret_id")
  actor       String
  action      String   // 'read' | 'decrypt' | 'update' | 'delete'
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, secretId])
  @@index([actor])
  @@map("vault_access_logs")
}
```

Add relation in Workspace model:

```prisma
model Workspace {
  // ... existing relations ...
  vaultAccessLogs VaultAccessLog[]
}
```

**Step 2: Generate and run migration**

```bash
cd packages/bff
npx prisma migrate dev --name add_vault_expires_and_access_log
npx prisma generate
```

**Step 3: tsc check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add packages/bff/prisma/
git commit -m "feat(schema): add VaultSecret.expiresAt + VaultAccessLog model"
```

---

## Task 2 (P2-7): Vault Service — Policy Enforcement + Access Logging

**Files:**
- Modify: `packages/bff/src/vault/vault.service.ts`
- Create: `packages/bff/src/vault/vault-access-log.service.ts`
- Test: `packages/bff/src/vault/vault-policy.spec.ts`

**Context:** Current `verifyAccess()` only checks workspace membership. Need to also verify the caller matches the Seal policy rules:
- `RULE_WORKSPACE_MEMBER (0)`: workspace member check (already done)
- `RULE_SPECIFIC_ADDRESS (1)`: check caller is in allowed_addresses list
- `RULE_ROLE_BASED (2)`: check caller's roleLevel >= policy.min_role_level

Policy data lives on-chain (crm_vault::policy::AccessPolicy object). BFF reads it via Sui RPC `getObject()`.

**Step 1: Write failing test**

```typescript
// vault-policy.spec.ts
import { Test } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('VaultService — Policy Enforcement', () => {
  let service: VaultService;
  let prisma: any;
  let suiClient: any;

  beforeEach(async () => {
    prisma = {
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({
          workspaceId: 'ws1',
          address: '0xcaller',
          roleLevel: 1,
          permissions: 31,
        }),
      },
      vaultSecret: { findUnique: jest.fn() },
      vaultAccessLog: { create: jest.fn() },
    };

    suiClient = {
      getObject: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'SuiClientService', useValue: suiClient },
        { provide: 'WalrusClient', useValue: {} },
        { provide: 'ConfigService', useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get(VaultService);
  });

  it('should allow access for RULE_WORKSPACE_MEMBER if caller is member', async () => {
    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', null),
    ).resolves.not.toThrow();
  });

  it('should allow access for RULE_SPECIFIC_ADDRESS if caller in list', async () => {
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 1,
            allowed_addresses: ['0xcaller', '0xother'],
            min_role_level: 0,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).resolves.not.toThrow();
  });

  it('should reject for RULE_SPECIFIC_ADDRESS if caller not in list', async () => {
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 1,
            allowed_addresses: ['0xother'],
            min_role_level: 0,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject for RULE_ROLE_BASED if role too low', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      roleLevel: 0, // VIEWER
      permissions: 1,
    });

    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 2,
            allowed_addresses: [],
            min_role_level: 2, // requires ADMIN
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/bff
npx jest vault-policy --no-coverage
```

Expected: FAIL

**Step 3: Implement policy enforcement in VaultService**

Add to `vault.service.ts`:

```typescript
// Add SuiClientService injection
constructor(
  private readonly walrusClient: WalrusClient,
  private readonly configService: ConfigService,
  private readonly prisma: PrismaService,
  private readonly suiClient: SuiClientService,
) {}

// Policy rule constants (match Move contract)
private readonly RULE_WORKSPACE_MEMBER = 0;
private readonly RULE_SPECIFIC_ADDRESS = 1;
private readonly RULE_ROLE_BASED = 2;

async verifyPolicyAccess(
  workspaceId: string,
  callerAddress: string,
  sealPolicyId: string | null,
): Promise<void> {
  // Base check: must be workspace member with MANAGE permission
  const member = await this.prisma.workspaceMember.findUnique({
    where: { workspaceId_address: { workspaceId, address: callerAddress } },
  });

  if (!member || (member.permissions & 16) === 0) {
    throw new UnauthorizedException('No access to this vault');
  }

  // If no seal policy, workspace membership is sufficient
  if (!sealPolicyId) return;

  // Fetch policy object from chain
  const policyObj = await this.suiClient.getObject(sealPolicyId);
  const fields = policyObj?.data?.content?.fields;
  if (!fields) return; // Policy not found on-chain, fall back to membership check

  const ruleType = Number(fields.rule_type);

  if (ruleType === this.RULE_WORKSPACE_MEMBER) {
    // Already verified membership above
    return;
  }

  if (ruleType === this.RULE_SPECIFIC_ADDRESS) {
    const allowed: string[] = fields.allowed_addresses ?? [];
    if (!allowed.includes(callerAddress)) {
      throw new UnauthorizedException(
        'Your address is not in the allowed list for this vault item',
      );
    }
    return;
  }

  if (ruleType === this.RULE_ROLE_BASED) {
    const minLevel = Number(fields.min_role_level);
    if (member.roleLevel < minLevel) {
      throw new UnauthorizedException(
        `Requires role level ${minLevel}, you have ${member.roleLevel}`,
      );
    }
    return;
  }

  throw new UnauthorizedException('Unknown policy rule type');
}
```

**Step 4: Update existing methods to use verifyPolicyAccess**

Replace `verifyAccess()` calls with `verifyPolicyAccess()` where sealPolicyId is available:

```typescript
async getSecret(workspaceId, callerAddress, profileId, key) {
  // Fetch first to get sealPolicyId
  const secret = await this.prisma.vaultSecret.findUnique({
    where: { workspaceId_profileId_key: { workspaceId, profileId, key } },
  });
  if (!secret) return null;

  await this.verifyPolicyAccess(workspaceId, callerAddress, secret.sealPolicyId);

  // Log access
  await this.logAccess(workspaceId, secret.id, callerAddress, 'read');

  // ... rest unchanged ...
}
```

**Step 5: Implement access logging**

```typescript
// vault-access-log.service.ts — or inline in vault.service.ts
private async logAccess(
  workspaceId: string,
  secretId: string,
  actor: string,
  action: string,
  metadata?: any,
) {
  await this.prisma.vaultAccessLog.create({
    data: { workspaceId, secretId, actor, action, metadata },
  });
}
```

**Step 6: Run tests**

```bash
npx jest vault-policy --no-coverage
npx tsc --noEmit
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/bff/src/vault/
git commit -m "feat(vault): add policy-based access enforcement + access logging"
```

---

## Task 3 (P2-7): Vault Time-Lock + Expiry Archival Job

**Files:**
- Modify: `packages/bff/src/vault/vault.service.ts` (storeSecret accepts expiresAt)
- Modify: `packages/bff/src/vault/vault.controller.ts` (DTO update)
- Create: `packages/bff/src/jobs/vault-expiry.job.ts`
- Modify: `packages/bff/src/jobs/jobs.service.ts`
- Test: `packages/bff/src/jobs/vault-expiry.job.spec.ts`

**Step 1: Write failing test for expiry job**

```typescript
// vault-expiry.job.spec.ts
import { Test } from '@nestjs/testing';
import { VaultExpiryJob } from './vault-expiry.job';
import { PrismaService } from '../prisma/prisma.service';

describe('VaultExpiryJob', () => {
  let job: VaultExpiryJob;
  let prisma: { vaultSecret: { deleteMany: jest.Mock }; vaultAccessLog: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vaultSecret: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      vaultAccessLog: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        VaultExpiryJob,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    job = module.get(VaultExpiryJob);
  });

  it('should delete expired secrets', async () => {
    await job.archiveExpired();

    expect(prisma.vaultSecret.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { not: null, lte: expect.any(Date) },
      },
    });
  });
});
```

**Step 2: Implement**

```typescript
// vault-expiry.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VaultExpiryJob {
  private readonly logger = new Logger(VaultExpiryJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async archiveExpired() {
    const result = await this.prisma.vaultSecret.deleteMany({
      where: {
        expiresAt: { not: null, lte: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Archived ${result.count} expired vault secrets`);
    }
  }
}
```

**Step 3: Update StoreSecretInput + DTO**

Add `expiresAt?: Date` to `StoreSecretInput` interface and `StoreSecretDto` class.

Pass through to Prisma create:

```typescript
create: {
  // ... existing fields ...
  expiresAt: dto.expiresAt ?? null,
},
```

**Step 4: Register job in JobsService**

**Step 5: Run tests, tsc, commit**

```bash
npx jest vault-expiry --no-coverage
npx tsc --noEmit
git add packages/bff/src/vault/ packages/bff/src/jobs/
git commit -m "feat(vault): time-lock with expiresAt + expiry archival job"
```

---

## Task 4 (P2-7): Frontend — Vault ACL Policy Selector + Time-Lock

**Files:**
- Modify: `packages/frontend/src/components/vault/vault-item-form.tsx`
- Modify: `packages/frontend/src/lib/hooks/use-vault-crypto.ts`
- Create: `packages/frontend/src/components/vault/policy-selector.tsx`
- Test: `packages/frontend/src/components/vault/__tests__/policy-selector.test.tsx`

**Context:** When creating a vault item, the user selects an access policy:
1. **Workspace Members** (default) — all workspace members can decrypt
2. **Specific Addresses** — user enters comma-separated addresses
3. **Role-Based** — user selects minimum role (Viewer, Member, Admin, Owner)

Also add optional expiresAt date picker for time-lock.

The VaultItemForm already has a policy selector (from P2-6 commit `feat(vault-ui): add policy selector`). Need to extend it with address input, role dropdown, and time-lock.

**Step 1: Read existing policy selector**

Check what's already in `vault-item-form.tsx` for the policy selector.

**Step 2: Write failing test**

```tsx
// policy-selector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PolicySelector } from '../policy-selector';

describe('PolicySelector', () => {
  it('shows workspace member as default', () => {
    render(<PolicySelector value={{ ruleType: 0 }} onChange={() => {}} />);
    expect(screen.getByText('Workspace Members')).toBeInTheDocument();
  });

  it('shows address input when specific address selected', async () => {
    const onChange = jest.fn();
    render(<PolicySelector value={{ ruleType: 0 }} onChange={onChange} />);

    // Select "Specific Addresses"
    fireEvent.click(screen.getByText('Specific Addresses'));

    expect(screen.getByPlaceholderText(/0x/)).toBeInTheDocument();
  });

  it('shows role dropdown when role-based selected', () => {
    render(
      <PolicySelector value={{ ruleType: 2, minRoleLevel: 1 }} onChange={() => {}} />,
    );
    expect(screen.getByText('Member')).toBeInTheDocument();
  });
});
```

**Step 3: Implement PolicySelector**

```tsx
// policy-selector.tsx
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PolicyValue {
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
}

const ROLES = [
  { value: '0', label: 'Viewer' },
  { value: '1', label: 'Member' },
  { value: '2', label: 'Admin' },
  { value: '3', label: 'Owner' },
];

export function PolicySelector({
  value,
  onChange,
}: {
  value: PolicyValue;
  onChange: (v: PolicyValue) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>Access Policy</Label>
      <RadioGroup
        value={String(value.ruleType)}
        onValueChange={(v) => onChange({ ...value, ruleType: Number(v) as 0 | 1 | 2 })}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="0" id="rule-0" />
          <Label htmlFor="rule-0">Workspace Members</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="1" id="rule-1" />
          <Label htmlFor="rule-1">Specific Addresses</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="2" id="rule-2" />
          <Label htmlFor="rule-2">Role-Based</Label>
        </div>
      </RadioGroup>

      {value.ruleType === 1 && (
        <Input
          placeholder="0xaddr1, 0xaddr2, ..."
          value={value.allowedAddresses?.join(', ') ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              allowedAddresses: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      )}

      {value.ruleType === 2 && (
        <Select
          value={String(value.minRoleLevel ?? 1)}
          onValueChange={(v) => onChange({ ...value, minRoleLevel: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
```

**Step 4: Add time-lock date picker to VaultItemForm**

Add an optional `expiresAt` DatePicker below the PolicySelector. Pass to store API.

**Step 5: Update useVaultCrypto to pass policy + expiresAt to BFF**

**Step 6: Run tests, commit**

```bash
pnpm test:run
git add packages/frontend/src/components/vault/ packages/frontend/src/lib/hooks/
git commit -m "feat(frontend): vault policy selector + time-lock date picker"
```

---

## Task 5 (P2-7): Vault Audit Log Endpoint + UI

**Files:**
- Modify: `packages/bff/src/vault/vault.controller.ts`
- Modify: `packages/bff/src/vault/vault.service.ts`
- Create: `packages/frontend/src/components/vault/vault-audit-log.tsx`
- Test: `packages/bff/src/vault/vault-audit.spec.ts`

**Step 1: Add BFF endpoint**

```typescript
// In vault.controller.ts
@Get('secrets/:profileId/:key/audit')
async getAuditLog(
  @Param('profileId') profileId: string,
  @Param('key') key: string,
  @User() user: UserPayload,
) {
  return this.vaultService.getAccessLog(user.workspaceId, profileId, key);
}
```

```typescript
// In vault.service.ts
async getAccessLog(workspaceId: string, profileId: string, key: string) {
  const secret = await this.prisma.vaultSecret.findUnique({
    where: { workspaceId_profileId_key: { workspaceId, profileId, key } },
  });
  if (!secret) return { logs: [] };

  const logs = await this.prisma.vaultAccessLog.findMany({
    where: { workspaceId, secretId: secret.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { logs };
}
```

**Step 2: Frontend audit log component**

Simple table showing: actor (truncated address), action, timestamp. Rendered inside VaultItemCard as expandable section.

**Step 3: Test, commit**

```bash
npx jest vault-audit --no-coverage
npx tsc --noEmit
pnpm test:run
git add packages/bff/src/vault/ packages/frontend/src/components/vault/
git commit -m "feat(vault): audit log endpoint + frontend display"
```

---

## Task 6 (P2-8): Prisma Migration — DealDocument Model

**Files:**
- Modify: `packages/bff/prisma/schema.prisma`

**Step 1: Add DealDocument model**

```prisma
model DealDocument {
  id           String   @id @default(uuid())
  dealId       String   @map("deal_id")
  workspaceId  String   @map("workspace_id")
  name         String
  walrusBlobId String   @map("walrus_blob_id")
  sealPolicyId String?  @map("seal_policy_id")
  mimeType     String?  @map("mime_type")
  fileSize     Int?     @map("file_size")
  uploadedBy   String   @map("uploaded_by")
  version      Int      @default(1)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  deal      Deal      @relation(fields: [dealId], references: [id])
  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@index([dealId])
  @@map("deal_documents")
}
```

Add relations:

```prisma
model Deal {
  // ... existing ...
  documents DealDocument[]
}

model Workspace {
  // ... existing ...
  dealDocuments DealDocument[]
}
```

**Step 2: Run migration**

```bash
cd packages/bff
npx prisma migrate dev --name add_deal_documents
npx prisma generate
```

**Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add packages/bff/prisma/
git commit -m "feat(schema): add DealDocument model for Deal Room"
```

---

## Task 7 (P2-8): BFF — Deal Document Service + Controller

**Files:**
- Create: `packages/bff/src/deal/deal-document.service.ts`
- Modify: `packages/bff/src/deal/deal.controller.ts`
- Modify: `packages/bff/src/deal/deal.module.ts`
- Test: `packages/bff/src/deal/deal-document.service.spec.ts`

**Step 1: Write failing test**

```typescript
// deal-document.service.spec.ts
import { Test } from '@nestjs/testing';
import { DealDocumentService } from './deal-document.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('DealDocumentService', () => {
  let service: DealDocumentService;
  let prisma: any;
  let walrusClient: any;

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      dealDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ permissions: 31 }),
      },
    };
    walrusClient = {
      uploadBlob: jest.fn().mockResolvedValue({ blobId: 'blob-1', url: 'https://...' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DealDocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'WalrusClient', useValue: walrusClient },
      ],
    }).compile();

    service = module.get(DealDocumentService);
  });

  it('should upload and create document', async () => {
    prisma.deal.findUnique.mockResolvedValue({ id: 'd1', workspaceId: 'ws1' });
    prisma.dealDocument.create.mockResolvedValue({ id: 'doc1' });

    const result = await service.uploadDocument('ws1', '0xcaller', {
      dealId: 'd1',
      name: 'contract.pdf',
      encryptedData: 'base64data',
      sealPolicyId: '0xpolicy',
      mimeType: 'application/pdf',
      fileSize: 1024,
    });

    expect(result.id).toBe('doc1');
    expect(walrusClient.uploadBlob).toHaveBeenCalled();
  });

  it('should list documents for deal', async () => {
    prisma.deal.findUnique.mockResolvedValue({ id: 'd1', workspaceId: 'ws1' });
    prisma.dealDocument.findMany.mockResolvedValue([
      { id: 'doc1', name: 'contract.pdf', createdAt: new Date() },
    ]);

    const docs = await service.listDocuments('ws1', '0xcaller', 'd1');
    expect(docs).toHaveLength(1);
  });

  it('should reject if deal not in workspace', async () => {
    prisma.deal.findUnique.mockResolvedValue({ id: 'd1', workspaceId: 'other-ws' });

    await expect(
      service.uploadDocument('ws1', '0xcaller', {
        dealId: 'd1',
        name: 'test.pdf',
        encryptedData: 'data',
      }),
    ).rejects.toThrow();
  });
});
```

**Step 2: Implement DealDocumentService**

```typescript
// deal-document.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from '../vault/walrus.client';

export interface UploadDocumentDto {
  dealId: string;
  name: string;
  encryptedData: string;
  sealPolicyId?: string;
  mimeType?: string;
  fileSize?: number;
}

@Injectable()
export class DealDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walrusClient: WalrusClient,
  ) {}

  async uploadDocument(
    workspaceId: string,
    callerAddress: string,
    dto: UploadDocumentDto,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Deal not in your workspace');
    }

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    return this.prisma.dealDocument.create({
      data: {
        dealId: dto.dealId,
        workspaceId,
        name: dto.name,
        walrusBlobId: uploadResult.blobId,
        sealPolicyId: dto.sealPolicyId,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedBy: callerAddress,
      },
    });
  }

  async listDocuments(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal || deal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Deal not accessible');
    }

    return this.prisma.dealDocument.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocument(workspaceId: string, documentId: string) {
    const doc = await this.prisma.dealDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.workspaceId !== workspaceId) {
      throw new ForbiddenException('Document not accessible');
    }

    return doc;
  }

  async deleteDocument(
    workspaceId: string,
    documentId: string,
    expectedVersion: number,
  ) {
    const deleted = await this.prisma.dealDocument.deleteMany({
      where: { id: documentId, workspaceId, version: expectedVersion },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Document not found or version mismatch');
    }

    return { success: true };
  }
}
```

**Step 3: Add controller endpoints**

```typescript
// In deal.controller.ts
@Post(':id/documents')
async uploadDocument(
  @Param('id') dealId: string,
  @Body() body: UploadDocumentBodyDto,
  @User() user: UserPayload,
) {
  return this.dealDocumentService.uploadDocument(
    user.workspaceId,
    user.address,
    { dealId, ...body },
  );
}

@Get(':id/documents')
async listDocuments(
  @Param('id') dealId: string,
  @User() user: UserPayload,
) {
  return this.dealDocumentService.listDocuments(
    user.workspaceId,
    user.address,
    dealId,
  );
}

@Delete('documents/:docId')
async deleteDocument(
  @Param('docId') docId: string,
  @Body('expectedVersion') expectedVersion: number,
  @User() user: UserPayload,
) {
  return this.dealDocumentService.deleteDocument(
    user.workspaceId,
    docId,
    expectedVersion,
  );
}
```

**Step 4: Run tests, tsc, commit**

```bash
npx jest deal-document --no-coverage
npx tsc --noEmit
git add packages/bff/src/deal/
git commit -m "feat(deal-room): add DealDocumentService with Walrus upload + Seal policy"
```

---

## Task 8 (P2-8): Frontend — Deal Documents Tab

**Files:**
- Create: `packages/frontend/src/components/deal/deal-documents.tsx`
- Create: `packages/frontend/src/components/deal/document-upload-form.tsx`
- Create: `packages/frontend/src/lib/hooks/use-deal-documents.ts`
- Modify: `packages/frontend/src/app/(dashboard)/deals/[id]/page.tsx`
- Test: `packages/frontend/src/components/deal/__tests__/deal-documents.test.tsx`

**Context:** Add "Documents" tab to deal detail page. Reuse Seal encrypt/decrypt from vault. Documents are encrypted with deal-specific policy (deal creator + profile addresses can decrypt).

**Step 1: Create hooks**

```typescript
// use-deal-documents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDealDocuments(dealId: string) {
  return useQuery({
    queryKey: ['deal-documents', dealId],
    queryFn: () => api.get(`/deals/${dealId}/documents`).then((r) => r.data),
    enabled: !!dealId,
  });
}

export function useUploadDealDocument(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      encryptedData: string;
      sealPolicyId?: string;
      mimeType?: string;
      fileSize?: number;
    }) => api.post(`/deals/${dealId}/documents`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-documents', dealId] }),
  });
}

export function useDeleteDealDocument(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, version }: { docId: string; version: number }) =>
      api.delete(`/deals/documents/${docId}`, { data: { expectedVersion: version } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-documents', dealId] }),
  });
}
```

**Step 2: Write failing test**

```tsx
// deal-documents.test.tsx
import { render, screen } from '@testing-library/react';
import { DealDocuments } from '../deal-documents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/hooks/use-deal-documents', () => ({
  useDealDocuments: () => ({
    data: [
      { id: 'doc1', name: 'contract.pdf', mimeType: 'application/pdf', fileSize: 1024, createdAt: new Date().toISOString() },
    ],
    isLoading: false,
  }),
  useUploadDealDocument: () => ({ mutateAsync: jest.fn() }),
  useDeleteDealDocument: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-seal-session', () => ({
  useSealSession: () => ({ sessionKey: null, startSession: jest.fn() }),
}));

const qc = new QueryClient();

describe('DealDocuments', () => {
  it('renders document list', () => {
    render(
      <QueryClientProvider client={qc}>
        <DealDocuments dealId="d1" workspaceId="ws1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
  });

  it('shows upload button', () => {
    render(
      <QueryClientProvider client={qc}>
        <DealDocuments dealId="d1" workspaceId="ws1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
  });
});
```

**Step 3: Implement DealDocuments component**

```tsx
// deal-documents.tsx
'use client';

import { useDealDocuments, useUploadDealDocument, useDeleteDealDocument } from '@/lib/hooks/use-deal-documents';
import { useSealSession } from '@/lib/hooks/use-seal-session';
import { DocumentUploadForm } from './document-upload-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileIcon, Trash2, Download, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export function DealDocuments({
  dealId,
  workspaceId,
}: {
  dealId: string;
  workspaceId: string;
}) {
  const { data: documents = [], isLoading } = useDealDocuments(dealId);
  const upload = useUploadDealDocument(dealId);
  const deleteMut = useDeleteDealDocument(dealId);
  const [showUpload, setShowUpload] = useState(false);

  if (isLoading) return <div className="animate-pulse h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Documents</h3>
        <Button onClick={() => setShowUpload(!showUpload)} size="sm">
          Upload Document
        </Button>
      </div>

      {showUpload && (
        <DocumentUploadForm
          dealId={dealId}
          onUpload={async (data) => {
            await upload.mutateAsync(data);
            setShowUpload(false);
          }}
          isLoading={upload.isPending}
        />
      )}

      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents yet.</p>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : ''} ·{' '}
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {doc.sealPolicyId && (
                    <Lock className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      deleteMut.mutate({ docId: doc.id, version: doc.version })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Implement DocumentUploadForm**

```tsx
// document-upload-form.tsx
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSealSession } from '@/lib/hooks/use-seal-session';
import { sealEncrypt } from '@/lib/crypto/seal-crypto';
import { Upload } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface Props {
  dealId: string;
  onUpload: (data: {
    name: string;
    encryptedData: string;
    sealPolicyId?: string;
    mimeType?: string;
    fileSize?: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export function DocumentUploadForm({ dealId, onUpload, isLoading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const { sessionKey } = useSealSession();

  const handleSubmit = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 5 MB)');
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Encrypt with Seal if session available, else store as base64
    let encryptedData: string;
    let sealPolicyId: string | undefined;

    if (sessionKey) {
      const result = await sealEncrypt(bytes, dealId);
      encryptedData = btoa(String.fromCharCode(...result.encryptedObject));
      sealPolicyId = result.policyId;
    } else {
      encryptedData = btoa(String.fromCharCode(...bytes));
    }

    await onUpload({
      name: file.name,
      encryptedData,
      sealPolicyId,
      mimeType: file.type,
      fileSize: file.size,
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Label>Select File</Label>
      <Input
        ref={fileRef}
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError('');
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleSubmit}
        disabled={!file || isLoading}
        size="sm"
      >
        <Upload className="mr-2 h-4 w-4" />
        {isLoading ? 'Uploading...' : 'Encrypt & Upload'}
      </Button>
    </div>
  );
}
```

**Step 5: Add Documents tab to deal detail page**

In `packages/frontend/src/app/(dashboard)/deals/[id]/page.tsx`, add a "Documents" tab that renders `<DealDocuments dealId={deal.id} workspaceId={workspace.id} />`.

**Step 6: Run tests, commit**

```bash
pnpm test:run
git add packages/frontend/src/
git commit -m "feat(frontend): deal room documents tab with encrypted upload/decrypt"
```

---

## Final: tsc + full test suite

```bash
cd packages/bff && npx tsc --noEmit
cd packages/frontend && pnpm test:run
```

Expected: All green.

```bash
git add -A
git commit -m "feat: complete Wave 2 — vault granular ACL + deal room encrypted docs"
```
