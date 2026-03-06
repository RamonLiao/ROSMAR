# Deal Chain Integration Design

**Date**: 2026-03-06
**Status**: Approved

## Problem

BFF `DealService` has chain integration but all 3 TxBuilder methods are broken:
- Wrong package ID (`crmDataPackageId` → should be `crmCorePackageId`)
- Wrong function names (`deal::create` → `deal::create_deal`)
- Wrong argument types (`stage` as string → should be `u8`, `profileId` as object → should be `ID`)
- `buildUpdateDealTx` uses Option wrappers but contract expects required params, wrong arg order
- `buildUpdateDealStageTx` calls non-existent `deal::update_stage`
- No `buildArchiveDealTx`
- No `SUI_DRY_RUN` bypass in DealService
- No AuditEventV1 indexing
- Prisma `Deal` model missing `isArchived`, `archivedAt`, `suiObjectId`
- No `AuditLog` model

## Contract Reference (deal.move)

```
create_deal(config, workspace, cap, profile_id: ID, title: String, amount_usd: u64, stage: u8, ctx) → Deal
update_deal(config, workspace, cap, deal: &mut Deal, expected_version: u64, title: String, amount_usd: u64, stage: u8, ctx)
archive_deal(config, workspace, cap, deal: &mut Deal, expected_version: u64, ctx)
```

All emit `AuditEventV1 { version, workspace_id, actor, action, object_type, object_id, timestamp }`.

## Design

### 1. TxBuilder (tx-builder.service.ts)

**Fix `buildCreateDealTx`**:
- target: `${crmCorePackageId}::deal::create_deal`
- args: `[object(config), object(workspace), object(cap), pure.address(profileId), pure.string(title), pure.u64(amountUsd), pure.u8(stage)]`

**Fix `buildUpdateDealTx`** — all params required, correct order:
- target: `${crmCorePackageId}::deal::update_deal`
- args: `[object(config), object(workspace), object(cap), object(dealId), pure.u64(expectedVersion), pure.string(title), pure.u64(amountUsd), pure.u8(stage)]`

**Delete `buildUpdateDealStageTx`** — no contract function.

**Add `buildArchiveDealTx`**:
- target: `${crmCorePackageId}::deal::archive_deal`
- args: `[object(config), object(workspace), object(cap), object(dealId), pure.u64(expectedVersion)]`

### 2. DealService (deal.service.ts)

- Add `execChainTx()` helper with `SUI_DRY_RUN` bypass
- Fix `create()`: corrected TxBuilder call, parse AuditEventV1 for object_id
- Fix `update()`: required params, read DB for unchanged fields, call `update_deal`
- Fix `updateStage()`: keep endpoint, internally read deal → call `update_deal` with full fields
- Add `archive()`: call `buildArchiveDealTx`, parse event, update Prisma
- All chain TX success → parse AuditEventV1 → write to `audit_logs`

### 3. Prisma Schema

**Deal model additions**:
```prisma
isArchived  Boolean   @default(false)
archivedAt  DateTime?
suiObjectId String?
```

**New AuditLog model**:
```prisma
model AuditLog {
  id          String    @id @default(uuid())
  workspaceId String
  actor       String
  action      Int       // 0=create, 1=update, 5=archive
  objectType  Int       // 3=deal (extensible to other types)
  objectId    String
  txDigest    String
  timestamp   DateTime
  createdAt   DateTime  @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}
```

### 4. DealController (deal.controller.ts)

- Add `PUT /deals/:id/archive` endpoint
- Optional: `GET /deals/:id/audit` endpoint

### Decision: Keep `PUT /deals/:id/stage`

Contract only has `update_deal` (all fields). Frontend kanban drag only sends stage. BFF reads current deal from DB, fills unchanged fields, calls `update_deal`. Convenience endpoint stays.
