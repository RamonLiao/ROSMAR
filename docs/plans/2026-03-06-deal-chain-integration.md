# Deal Chain Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all broken TxBuilder deal methods, add archive support, add AuditLog indexing, and align Prisma schema with on-chain Deal struct.

**Architecture:** BFF write path: Service → TxBuilder (build Move call) → SuiClient (sign+execute) → parse AuditEventV1 → Prisma write (deal + audit_logs). Dry-run bypasses TX build entirely. Stage mapping: frontend string → u8 at BFF boundary.

**Tech Stack:** NestJS 11, Prisma 7, @mysten/sui v2.4.0, Move (crm_core::deal)

---

### Task 1: Prisma Schema — Add Deal fields + AuditLog model

**Files:**
- Modify: `packages/bff/prisma/schema.prisma:89-105` (Deal model)
- Modify: `packages/bff/prisma/schema.prisma:9` (Workspace relations)
- Create: migration via `npx prisma migrate dev`

**Step 1: Add fields to Deal model and create AuditLog model**

In `schema.prisma`, replace the Deal model (lines 89-105):

```prisma
model Deal {
  id          String    @id
  workspaceId String    @map("workspace_id")
  profileId   String    @map("profile_id")
  suiObjectId String?   @map("sui_object_id")
  title       String
  amountUsd   Decimal   @map("amount_usd") @db.Decimal(18, 2)
  stage       String
  notes       String?
  version     Int       @default(1)
  isArchived  Boolean   @default(false) @map("is_archived")
  archivedAt  DateTime? @map("archived_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  profile     Profile   @relation(fields: [profileId], references: [id])

  @@map("deals")
}
```

After the `PasskeyCredential` model, add:

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  workspaceId String   @map("workspace_id")
  actor       String
  action      Int
  objectType  Int      @map("object_type")
  objectId    String   @map("object_id")
  txDigest    String   @map("tx_digest")
  timestamp   DateTime
  createdAt   DateTime @default(now()) @map("created_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, objectType, objectId])
  @@index([txDigest])
  @@map("audit_logs")
}
```

Add `auditLogs AuditLog[]` to the Workspace model's relations (after `tickets`).

**Step 2: Run migration**

Run: `cd packages/bff && npx prisma migrate dev --name add_deal_archive_and_audit_logs`
Expected: Migration created and applied, Prisma client regenerated.

**Step 3: Verify**

Run: `cd packages/bff && npx prisma generate`
Expected: No errors.

**Step 4: Commit**

```
git add packages/bff/prisma/
git commit -m "feat(schema): add Deal archive fields and AuditLog model"
```

---

### Task 2: TxBuilder — Fix deal methods + add archive

**Files:**
- Modify: `packages/bff/src/blockchain/tx-builder.service.ts:270-358`

**Step 1: Add stage mapping constant**

At the top of `tx-builder.service.ts` (after imports, before class), add:

```typescript
/** Map frontend stage strings to on-chain u8 values (crm_core::deal) */
const STAGE_MAP: Record<string, number> = {
  prospecting: 0,
  qualification: 1,
  proposal: 2,
  negotiation: 3,
  closed_won: 4,
  closed_lost: 5,
};

export function stageToU8(stage: string): number {
  const val = STAGE_MAP[stage];
  if (val === undefined) throw new Error(`Invalid deal stage: "${stage}"`);
  return val;
}
```

**Step 2: Replace `buildCreateDealTx` (lines 273-298)**

```typescript
buildCreateDealTx(
  globalConfigId: string,
  workspaceId: string,
  adminCapId: string,
  profileId: string,
  title: string,
  amountUsd: number,
  stage: string,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${this.crmCorePackageId}::deal::create_deal`,
    arguments: [
      tx.object(globalConfigId),
      tx.object(workspaceId),
      tx.object(adminCapId),
      tx.pure.address(profileId),
      tx.pure.string(title),
      tx.pure.u64(amountUsd),
      tx.pure.u8(stageToU8(stage)),
    ],
  });

  return tx;
}
```

**Step 3: Replace `buildUpdateDealTx` (lines 303-330)**

```typescript
buildUpdateDealTx(
  globalConfigId: string,
  workspaceId: string,
  adminCapId: string,
  dealObjectId: string,
  expectedVersion: number,
  title: string,
  amountUsd: number,
  stage: string,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${this.crmCorePackageId}::deal::update_deal`,
    arguments: [
      tx.object(globalConfigId),
      tx.object(workspaceId),
      tx.object(adminCapId),
      tx.object(dealObjectId),
      tx.pure.u64(expectedVersion),
      tx.pure.string(title),
      tx.pure.u64(amountUsd),
      tx.pure.u8(stageToU8(stage)),
    ],
  });

  return tx;
}
```

**Step 4: Delete `buildUpdateDealStageTx` (lines 335-358)**

Remove entirely. No contract function for it.

**Step 5: Add `buildArchiveDealTx`**

```typescript
buildArchiveDealTx(
  globalConfigId: string,
  workspaceId: string,
  adminCapId: string,
  dealObjectId: string,
  expectedVersion: number,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${this.crmCorePackageId}::deal::archive_deal`,
    arguments: [
      tx.object(globalConfigId),
      tx.object(workspaceId),
      tx.object(adminCapId),
      tx.object(dealObjectId),
      tx.pure.u64(expectedVersion),
    ],
  });

  return tx;
}
```

**Step 6: Verify build**

Run: `cd packages/bff && npx tsc --noEmit`
Expected: Compile errors in `deal.service.ts` (expected — we changed signatures). No errors in `tx-builder.service.ts`.

**Step 7: Commit**

```
git add packages/bff/src/blockchain/tx-builder.service.ts
git commit -m "fix(txbuilder): align deal methods with crm_core::deal contract"
```

---

### Task 3: DealService — Rewrite write path + add archive + audit indexing

**Files:**
- Modify: `packages/bff/src/deal/deal.service.ts` (full rewrite of write methods)

**Step 1: Rewrite `deal.service.ts`**

Replace the entire file with:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { NotificationService } from '../notification/notification.service';

export interface CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
  notes?: string;
}

export interface UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  notes?: string;
  expectedVersion: number;
}

@Injectable()
export class DealService {
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  /** Skip TX build entirely in dry-run mode (per lessons.md) */
  private async execChainTx(buildTx: () => any): Promise<any> {
    if (this.isDryRun) {
      return { digest: 'dry-run', events: [] };
    }
    const tx = buildTx();
    return this.suiClient.executeTransaction(tx);
  }

  /** Parse AuditEventV1 from chain result and write to audit_logs */
  private async indexAuditEvent(
    result: any,
    txDigest: string,
  ): Promise<void> {
    if (this.isDryRun) return;

    const auditEvent = result.events?.find(
      (e: any) => e.type.includes('::deal::AuditEventV1'),
    );
    if (!auditEvent?.parsedJson) return;

    const ev = auditEvent.parsedJson as any;
    await this.prisma.auditLog.create({
      data: {
        workspaceId: ev.workspace_id,
        actor: ev.actor,
        action: Number(ev.action),
        objectType: Number(ev.object_type),
        objectId: ev.object_id,
        txDigest,
        timestamp: new Date(Number(ev.timestamp)),
      },
    });
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateDealDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildCreateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        dto.profileId,
        dto.title,
        dto.amountUsd,
        dto.stage,
      ),
    );

    // Parse object_id from AuditEventV1 (more reliable than DealCreated)
    const auditEvent = result.events?.find(
      (e: any) => e.type.includes('::deal::AuditEventV1'),
    );
    const suiObjectId = (auditEvent?.parsedJson as any)?.object_id ?? null;
    const dealId = suiObjectId || randomUUID();

    await this.prisma.deal.create({
      data: {
        id: dealId,
        workspaceId,
        profileId: dto.profileId,
        suiObjectId,
        title: dto.title,
        amountUsd: dto.amountUsd,
        stage: dto.stage,
        notes: dto.notes ?? null,
      },
    });

    await this.indexAuditEvent(result, result.digest);

    return { dealId, suiObjectId, txDigest: result.digest };
  }

  async getDeal(dealId: string): Promise<any> {
    return this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });
  }

  async listDeals(
    workspaceId: string,
    profileId?: string,
    stage?: string,
    limit?: number,
    offset?: number,
  ): Promise<any> {
    const where: any = { workspaceId, isArchived: false };
    if (profileId) where.profileId = profileId;
    if (stage) where.stage = stage;

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return { deals, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    dto: UpdateDealDto,
  ): Promise<any> {
    // Read current deal to fill unchanged fields (contract requires all)
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const title = dto.title ?? deal.title;
    const amountUsd = dto.amountUsd ?? Number(deal.amountUsd);
    const stage = dto.stage ?? deal.stage;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildUpdateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        dto.expectedVersion,
        title,
        amountUsd,
        stage,
      ),
    );

    const updateData: any = {
      version: { increment: 1 },
      title,
      amountUsd,
      stage,
    };
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    await this.prisma.deal.update({
      where: { id: dealId, version: dto.expectedVersion },
      data: updateData,
    });

    await this.indexAuditEvent(result, result.digest);

    return { success: true, txDigest: result.digest };
  }

  async updateStage(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    stage: string,
    expectedVersion: number,
  ): Promise<any> {
    // Convenience: read deal, call update_deal with full fields
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildUpdateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        expectedVersion,
        deal.title,
        Number(deal.amountUsd),
        stage,
      ),
    );

    await this.prisma.deal.update({
      where: { id: dealId, version: expectedVersion },
      data: { stage, version: { increment: 1 } },
    });

    await this.indexAuditEvent(result, result.digest);

    this.notificationService
      .create({
        workspaceId,
        userId: callerAddress,
        type: 'deal_stage_changed',
        title: `Deal stage changed to "${stage}"`,
        metadata: { dealId, stage },
      })
      .catch(() => {});

    return { success: true, txDigest: result.digest };
  }

  async archive(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    expectedVersion: number,
  ): Promise<any> {
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildArchiveDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        expectedVersion,
      ),
    );

    await this.prisma.deal.update({
      where: { id: dealId, version: expectedVersion },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.indexAuditEvent(result, result.digest);

    return { success: true, txDigest: result.digest };
  }

  async getAuditLogs(objectId: string): Promise<any> {
    return this.prisma.auditLog.findMany({
      where: { objectId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
```

**Step 2: Verify build**

Run: `cd packages/bff && npx tsc --noEmit`
Expected: Compile errors in `deal.controller.ts` (needs archive endpoint). Service should compile.

**Step 3: Commit**

```
git add packages/bff/src/deal/deal.service.ts
git commit -m "fix(deal): rewrite service with correct chain calls, dry-run, archive, audit indexing"
```

---

### Task 4: DealController — Add archive + audit endpoints

**Files:**
- Modify: `packages/bff/src/deal/deal.controller.ts`

**Step 1: Add archive and audit endpoints**

After the `updateStage` method (line 103), add:

```typescript
@Put(':id/archive')
@RequirePermissions(WRITE)
async archive(
  @User() user: import('../auth/auth.service').UserPayload,
  @Param('id') id: string,
  @Body('expectedVersion') expectedVersion: number,
) {
  return this.dealService.archive(
    user.workspaceId,
    user.address,
    id,
    expectedVersion,
  );
}

@Get(':id/audit')
async getAuditLogs(@Param('id') id: string) {
  return this.dealService.getAuditLogs(id);
}
```

**Step 2: Verify build**

Run: `cd packages/bff && npx tsc --noEmit`
Expected: Clean compile, no errors.

**Step 3: Commit**

```
git add packages/bff/src/deal/deal.controller.ts
git commit -m "feat(deal): add archive and audit-log endpoints"
```

---

### Task 5: BFF stage constants — Add shared mapping

**Files:**
- Create: `packages/bff/src/deal/deal.constants.ts`

**Step 1: Create shared stage constants for BFF**

```typescript
/**
 * Deal stage mapping — single source of truth for BFF.
 * Must stay in sync with:
 *   - crm_core::deal (STAGE_LEAD..STAGE_LOST = 0..5)
 *   - frontend: packages/frontend/src/lib/constants.ts (DEAL_STAGES)
 */
export const DEAL_STAGES = {
  prospecting: { u8: 0, label: 'Prospecting' },
  qualification: { u8: 1, label: 'Qualification' },
  proposal: { u8: 2, label: 'Proposal' },
  negotiation: { u8: 3, label: 'Negotiation' },
  closed_won: { u8: 4, label: 'Closed Won' },
  closed_lost: { u8: 5, label: 'Closed Lost' },
} as const;

export type DealStage = keyof typeof DEAL_STAGES;
```

Note: The `stageToU8()` function in `tx-builder.service.ts` (Task 2) does the runtime mapping. This file is for documentation and potential future validation.

**Step 2: Commit**

```
git add packages/bff/src/deal/deal.constants.ts
git commit -m "feat(deal): add BFF stage constants for chain mapping"
```

---

### Task 6: Move tests — Verify deal.move still passes

**Files:**
- Read-only: `packages/move/crm_core/tests/crm_core_tests.move`

**Step 1: Run Move tests**

Run: `cd packages/move/crm_core && sui move test`
Expected: 36/36 tests pass (no Move changes, just verification).

**Step 2: No commit needed** (verification only)

---

### Task 7: Frontend — Update hooks for new response shape

**Files:**
- Modify: `packages/frontend/src/lib/hooks/use-deals.ts`

**Step 1: Check if frontend hooks need updates**

The `create` response now returns `{ dealId, suiObjectId, txDigest }` instead of `{ dealId, txDigest }`.
The `update`/`updateStage` responses stay `{ success, txDigest }`.
The `archive` is a new endpoint.
The `listDeals` now filters `isArchived: false` by default.

Read `use-deals.ts` and update:
- Add `archiveDeal` mutation calling `PUT /deals/:id/archive`
- Add `useAuditLogs` query calling `GET /deals/:id/audit`
- Verify existing mutations handle the response shape correctly

**Step 2: Verify frontend build**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Commit**

```
git add packages/frontend/src/lib/hooks/use-deals.ts
git commit -m "feat(frontend): add archiveDeal mutation and useAuditLogs hook"
```

---

### Task 8: Type-check + existing tests

**Step 1: Full BFF type-check**

Run: `cd packages/bff && npx tsc --noEmit`
Expected: Clean.

**Step 2: Full frontend type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Run existing frontend tests**

Run: `cd packages/frontend && npx vitest run`
Expected: All existing tests pass. Deal-related tests may need mock updates for the new `archive` method and `suiObjectId` field.

**Step 4: Fix any test failures, then commit**

```
git add -A
git commit -m "fix: update tests for deal chain integration changes"
```
