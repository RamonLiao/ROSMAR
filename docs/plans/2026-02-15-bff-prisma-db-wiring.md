# BFF Prisma DB Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw `pg` Pool and mock data in BFF services with Prisma ORM for core CRM entities.

**Architecture:** Services do Sui TX (write to chain) then Prisma (optimistic write to PG). Reads stay as gRPC stubs. A `SUI_DRY_RUN=true` flag lets the DB layer work without a live Sui network by generating UUIDs instead of on-chain IDs.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, @mysten/sui v2.4.0

---

### Task 1: Install Prisma & Create Schema

**Files:**
- Modify: `packages/bff/package.json`
- Create: `packages/bff/prisma/schema.prisma`
- Create: `packages/bff/.env.example`

**Step 1: Install dependencies**

Run (from `packages/bff`):
```bash
pnpm add @prisma/client
pnpm add -D prisma
pnpm remove pg 2>/dev/null; true
```

**Step 2: Create `.env.example`**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rosmar_crm?schema=public"
SUI_DRY_RUN=true
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_NETWORK=testnet
SUI_PRIVATE_KEY=
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=15m
GLOBAL_CONFIG_ID=0x0
ADMIN_CAP_ID=0x0
CRM_CORE_PACKAGE_ID=0x0
CRM_DATA_PACKAGE_ID=0x0
CRM_VAULT_PACKAGE_ID=0x0
CRM_ACTION_PACKAGE_ID=0x0
CORE_GRPC_URL=localhost:50051
```

**Step 3: Create Prisma schema**

```prisma
// packages/bff/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id            String   @id @default(uuid())
  suiObjectId   String?  @map("sui_object_id")
  name          String
  ownerAddress  String   @map("owner_address")
  createdAt     DateTime @default(now()) @map("created_at")

  members       WorkspaceMember[]
  profiles      Profile[]
  organizations Organization[]
  deals         Deal[]
  segments      Segment[]

  @@map("workspaces")
}

model WorkspaceMember {
  workspaceId String   @map("workspace_id")
  address     String
  roleLevel   Int      @map("role_level")
  permissions Int
  joinedAt    DateTime @default(now()) @map("joined_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@id([workspaceId, address])
  @@map("workspace_members")
}

model Profile {
  id              String   @id
  workspaceId     String   @map("workspace_id")
  primaryAddress  String   @map("primary_address")
  suinsName       String?  @map("suins_name")
  tags            String[] @default([])
  tier            Int      @default(0)
  engagementScore Int      @default(0) @map("engagement_score")
  version         Int      @default(1)
  isArchived      Boolean  @default(false) @map("is_archived")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  organizations   ProfileOrganization[]
  segmentMemberships SegmentMembership[]
  deals           Deal[]

  @@map("profiles")
}

model Organization {
  id          String   @id
  workspaceId String   @map("workspace_id")
  name        String
  domain      String?
  tags        String[] @default([])
  version     Int      @default(1)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  profiles    ProfileOrganization[]

  @@map("organizations")
}

model Deal {
  id          String   @id
  workspaceId String   @map("workspace_id")
  profileId   String   @map("profile_id")
  title       String
  amountUsd   Decimal  @map("amount_usd") @db.Decimal(18, 2)
  stage       String
  version     Int      @default(1)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  profile     Profile   @relation(fields: [profileId], references: [id])

  @@map("deals")
}

model Segment {
  id              String    @id
  workspaceId     String    @map("workspace_id")
  name            String
  description     String?
  rules           Json
  version         Int       @default(1)
  lastRefreshedAt DateTime? @map("last_refreshed_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  memberships     SegmentMembership[]

  @@map("segments")
}

model ProfileOrganization {
  profileId      String   @map("profile_id")
  organizationId String   @map("organization_id")
  createdAt      DateTime @default(now()) @map("created_at")

  profile        Profile      @relation(fields: [profileId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@id([profileId, organizationId])
  @@map("profile_organizations")
}

model SegmentMembership {
  segmentId String   @map("segment_id")
  profileId String   @map("profile_id")
  joinedAt  DateTime @default(now()) @map("joined_at")

  segment   Segment @relation(fields: [segmentId], references: [id])
  profile   Profile @relation(fields: [profileId], references: [id])

  @@id([segmentId, profileId])
  @@map("segment_memberships")
}
```

**Step 4: Generate Prisma client & create initial migration**

Run (from `packages/bff`):
```bash
npx prisma generate
npx prisma migrate dev --name init
```
Expected: Migration created, client generated. Requires running PostgreSQL with `rosmar_crm` database.

**Step 5: Commit**

```bash
git add packages/bff/prisma/ packages/bff/package.json packages/bff/pnpm-lock.yaml packages/bff/.env.example
git commit -m "feat(bff): add Prisma schema with 8 tables for core CRM entities"
```

---

### Task 2: Create PrismaModule & PrismaService

**Files:**
- Create: `packages/bff/src/prisma/prisma.service.ts`
- Create: `packages/bff/src/prisma/prisma.module.ts`

**Step 1: Create PrismaService**

```typescript
// packages/bff/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Step 2: Create PrismaModule**

```typescript
// packages/bff/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/prisma/
git commit -m "feat(bff): add global PrismaModule and PrismaService"
```

---

### Task 3: Add Dry-Run Mode to SuiClientService

**Files:**
- Modify: `packages/bff/src/blockchain/sui.client.ts`

**Step 1: Add dry-run logic to `executeTransaction`**

Replace `executeTransaction` method. When `SUI_DRY_RUN=true`:
- Skip actual Sui TX
- Return mock result with `digest: 'dry-run'` and empty events
- Services will use a generated UUID as entity ID when event parsing returns undefined

```typescript
// In SuiClientService, add to constructor:
private isDryRun: boolean;

// In constructor body, after keypair setup:
this.isDryRun = this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';

// Replace executeTransaction:
async executeTransaction(tx: Transaction) {
  if (this.isDryRun) {
    return {
      digest: 'dry-run',
      events: [],
      effects: { status: { status: 'success' } },
      objectChanges: [],
    };
  }

  const result = await this.client.signAndExecuteTransaction({
    signer: this.keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  return result;
}
```

**Step 2: Commit**

```bash
git add packages/bff/src/blockchain/sui.client.ts
git commit -m "feat(bff): add SUI_DRY_RUN mode to skip on-chain transactions"
```

---

### Task 4: Wire AppModule with All Domain Modules

**Files:**
- Modify: `packages/bff/src/app.module.ts`

**Step 1: Import all modules**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';
import { OrganizationModule } from './organization/organization.module';
import { DealModule } from './deal/deal.module';
import { SegmentModule } from './segment/segment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    ProfileModule,
    OrganizationModule,
    DealModule,
    SegmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Step 2: Commit**

```bash
git add packages/bff/src/app.module.ts
git commit -m "feat(bff): wire AppModule with ConfigModule, PrismaModule, and domain modules"
```

---

### Task 5: Refactor ProfileService to Use Prisma

**Files:**
- Modify: `packages/bff/src/profile/profile.service.ts`
- Modify: `packages/bff/src/profile/profile.module.ts`

**Step 1: Rewrite ProfileService**

Key changes:
- Remove `@ts-nocheck`, `pg` Pool, manual SQL
- Inject `PrismaService` instead
- Use `crypto.randomUUID()` as fallback ID when Sui event is undefined (dry-run mode)
- Keep gRPC stubs for reads unchanged

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProfileDto {
  primaryAddress: string;
  suinsName?: string;
  tags?: string[];
}

export interface UpdateProfileDto {
  suinsName?: string;
  tags?: string[];
  expectedVersion: number;
}

@Injectable()
export class ProfileService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getProfile: () => Promise.resolve({}),
      listProfiles: () => Promise.resolve({}),
    };
  }

  async create(workspaceId: string, callerAddress: string, dto: CreateProfileDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildCreateProfileTx(
      globalConfigId, workspaceId, adminCapId,
      dto.primaryAddress, dto.suinsName || null, dto.tags || [],
    );

    const result = await this.suiClient.executeTransaction(tx);

    const profileCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::profile::ProfileCreated'),
    );
    const profileId = profileCreatedEvent?.parsedJson?.profile_id ?? randomUUID();

    await this.prisma.profile.create({
      data: {
        id: profileId,
        workspaceId,
        primaryAddress: dto.primaryAddress,
        suinsName: dto.suinsName ?? null,
        tags: dto.tags ?? [],
      },
    });

    return { profileId, txDigest: result.digest };
  }

  async getProfile(profileId: string) {
    return this.grpcClient.getProfile({ profile_id: profileId });
  }

  async listProfiles(workspaceId: string, limit: number, offset: number) {
    return this.grpcClient.listProfiles({ workspace_id: workspaceId, limit, offset });
  }

  async updateTags(workspaceId: string, callerAddress: string, profileId: string, dto: UpdateProfileDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildUpdateProfileTagsTx(
      globalConfigId, workspaceId, adminCapId,
      profileId, dto.tags || [], dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        tags: dto.tags ?? [],
        version: { increment: 1 },
      },
    });

    return { success: true, txDigest: result.digest };
  }

  async archive(workspaceId: string, callerAddress: string, profileId: string, expectedVersion: number) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildArchiveProfileTx(
      globalConfigId, workspaceId, adminCapId, profileId, expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        isArchived: true,
        version: { increment: 1 },
      },
    });

    return { success: true, txDigest: result.digest };
  }
}
```

**Step 2: Update ProfileModule to provide blockchain dependencies**

```typescript
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, SuiClientService, TxBuilderService],
  exports: [ProfileService],
})
export class ProfileModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/profile/
git commit -m "feat(bff): refactor ProfileService to use Prisma, remove raw pg"
```

---

### Task 6: Refactor OrganizationService to Use Prisma

**Files:**
- Modify: `packages/bff/src/organization/organization.service.ts`
- Modify: `packages/bff/src/organization/organization.module.ts`

**Step 1: Rewrite OrganizationService**

Same pattern as ProfileService: remove `@ts-nocheck`, `pg`, inject `PrismaService`, use `prisma.organization.*` and `prisma.profileOrganization.*` for `linkProfile`.

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateOrganizationDto {
  name: string;
  domain?: string;
  tags?: string[];
}

export interface UpdateOrganizationDto {
  name?: string;
  domain?: string;
  tags?: string[];
  expectedVersion: number;
}

@Injectable()
export class OrganizationService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getOrganization: () => Promise.resolve({}),
      listOrganizations: () => Promise.resolve({}),
    };
  }

  async create(workspaceId: string, callerAddress: string, dto: CreateOrganizationDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildCreateOrganizationTx(
      globalConfigId, workspaceId, adminCapId,
      dto.name, dto.domain || null, dto.tags || [],
    );

    const result = await this.suiClient.executeTransaction(tx);

    const orgCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::organization::OrganizationCreated'),
    );
    const organizationId = orgCreatedEvent?.parsedJson?.organization_id ?? randomUUID();

    await this.prisma.organization.create({
      data: {
        id: organizationId,
        workspaceId,
        name: dto.name,
        domain: dto.domain ?? null,
        tags: dto.tags ?? [],
      },
    });

    return { organizationId, txDigest: result.digest };
  }

  async getOrganization(organizationId: string) {
    return this.grpcClient.getOrganization({ organization_id: organizationId });
  }

  async listOrganizations(workspaceId: string, limit: number, offset: number) {
    return this.grpcClient.listOrganizations({ workspace_id: workspaceId, limit, offset });
  }

  async update(workspaceId: string, callerAddress: string, organizationId: string, dto: UpdateOrganizationDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildUpdateOrganizationTx(
      globalConfigId, workspaceId, adminCapId,
      organizationId, dto.name, dto.domain, dto.tags, dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        version: { increment: 1 },
      },
    });

    return { success: true, txDigest: result.digest };
  }

  async linkProfile(workspaceId: string, callerAddress: string, organizationId: string, profileId: string) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildLinkProfileToOrgTx(
      globalConfigId, workspaceId, adminCapId, organizationId, profileId,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.profileOrganization.create({
      data: { profileId, organizationId },
    });

    return { success: true, txDigest: result.digest };
  }
}
```

**Step 2: Update OrganizationModule**

```typescript
import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, SuiClientService, TxBuilderService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/organization/
git commit -m "feat(bff): refactor OrganizationService to use Prisma"
```

---

### Task 7: Refactor DealService to Use Prisma

**Files:**
- Modify: `packages/bff/src/deal/deal.service.ts`
- Modify: `packages/bff/src/deal/deal.module.ts`

**Step 1: Rewrite DealService**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
}

export interface UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  expectedVersion: number;
}

@Injectable()
export class DealService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getDeal: () => Promise.resolve({}),
      listDeals: () => Promise.resolve({}),
    };
  }

  async create(workspaceId: string, callerAddress: string, dto: CreateDealDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildCreateDealTx(
      globalConfigId, workspaceId, adminCapId,
      dto.profileId, dto.title, dto.amountUsd, dto.stage,
    );

    const result = await this.suiClient.executeTransaction(tx);

    const dealCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::deal::DealCreated'),
    );
    const dealId = dealCreatedEvent?.parsedJson?.deal_id ?? randomUUID();

    await this.prisma.deal.create({
      data: {
        id: dealId,
        workspaceId,
        profileId: dto.profileId,
        title: dto.title,
        amountUsd: dto.amountUsd,
        stage: dto.stage,
      },
    });

    return { dealId, txDigest: result.digest };
  }

  async getDeal(dealId: string) {
    return this.grpcClient.getDeal({ deal_id: dealId });
  }

  async listDeals(workspaceId: string, profileId?: string, stage?: string, limit?: number, offset?: number) {
    return this.grpcClient.listDeals({ workspace_id: workspaceId, profile_id: profileId, stage, limit, offset });
  }

  async update(workspaceId: string, callerAddress: string, dealId: string, dto: UpdateDealDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildUpdateDealTx(
      globalConfigId, workspaceId, adminCapId,
      dealId, dto.title, dto.amountUsd, dto.stage, dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.amountUsd !== undefined && { amountUsd: dto.amountUsd }),
        ...(dto.stage !== undefined && { stage: dto.stage }),
        version: { increment: 1 },
      },
    });

    return { success: true, txDigest: result.digest };
  }

  async updateStage(workspaceId: string, callerAddress: string, dealId: string, stage: string, expectedVersion: number) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildUpdateDealStageTx(
      globalConfigId, workspaceId, adminCapId,
      dealId, stage, expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.deal.update({
      where: { id: dealId },
      data: { stage, version: { increment: 1 } },
    });

    return { success: true, txDigest: result.digest };
  }
}
```

**Step 2: Update DealModule**

```typescript
import { Module } from '@nestjs/common';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [DealController],
  providers: [DealService, SuiClientService, TxBuilderService],
  exports: [DealService],
})
export class DealModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/deal/
git commit -m "feat(bff): refactor DealService to use Prisma"
```

---

### Task 8: Refactor SegmentService to Use Prisma

**Files:**
- Modify: `packages/bff/src/segment/segment.service.ts`
- Modify: `packages/bff/src/segment/segment.module.ts`

**Step 1: Rewrite SegmentService**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSegmentDto {
  name: string;
  description?: string;
  rules: any;
}

export interface UpdateSegmentDto {
  name?: string;
  description?: string;
  rules?: any;
  expectedVersion: number;
}

@Injectable()
export class SegmentService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getSegment: () => Promise.resolve({}),
      listSegments: () => Promise.resolve({}),
      evaluateSegment: () => Promise.resolve({}),
    };
  }

  async create(workspaceId: string, callerAddress: string, dto: CreateSegmentDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildCreateSegmentTx(
      globalConfigId, workspaceId, adminCapId,
      dto.name, dto.description || '', JSON.stringify(dto.rules),
    );

    const result = await this.suiClient.executeTransaction(tx);

    const segmentCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::segment::SegmentCreated'),
    );
    const segmentId = segmentCreatedEvent?.parsedJson?.segment_id ?? randomUUID();

    await this.prisma.segment.create({
      data: {
        id: segmentId,
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        rules: dto.rules,
      },
    });

    return { segmentId, txDigest: result.digest };
  }

  async getSegment(segmentId: string) {
    return this.grpcClient.getSegment({ segment_id: segmentId });
  }

  async listSegments(workspaceId: string, limit: number, offset: number) {
    return this.grpcClient.listSegments({ workspace_id: workspaceId, limit, offset });
  }

  async update(workspaceId: string, callerAddress: string, segmentId: string, dto: UpdateSegmentDto) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildUpdateSegmentTx(
      globalConfigId, workspaceId, adminCapId,
      segmentId, dto.name, dto.description,
      dto.rules ? JSON.stringify(dto.rules) : undefined,
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.segment.update({
      where: { id: segmentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rules !== undefined && { rules: dto.rules }),
        version: { increment: 1 },
      },
    });

    return { success: true, txDigest: result.digest };
  }

  async evaluateSegment(segmentId: string, limit: number, offset: number) {
    return this.grpcClient.evaluateSegment({ segment_id: segmentId, limit, offset });
  }

  async refreshSegment(workspaceId: string, callerAddress: string, segmentId: string) {
    const profiles = await this.grpcClient.evaluateSegment({
      segment_id: segmentId, limit: 10000, offset: 0,
    });

    const profileIds: string[] = profiles.profile_ids || [];

    await this.prisma.$transaction([
      this.prisma.segmentMembership.deleteMany({ where: { segmentId } }),
      ...(profileIds.length > 0
        ? [this.prisma.segmentMembership.createMany({
            data: profileIds.map((pid) => ({ segmentId, profileId: pid })),
            skipDuplicates: true,
          })]
        : []),
      this.prisma.segment.update({
        where: { id: segmentId },
        data: { lastRefreshedAt: new Date() },
      }),
    ]);

    return { success: true, profileCount: profileIds.length };
  }
}
```

**Step 2: Update SegmentModule**

```typescript
import { Module } from '@nestjs/common';
import { SegmentController } from './segment.controller';
import { SegmentService } from './segment.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [SegmentController],
  providers: [SegmentService, SuiClientService, TxBuilderService],
  exports: [SegmentService],
})
export class SegmentModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/segment/
git commit -m "feat(bff): refactor SegmentService to use Prisma"
```

---

### Task 9: Refactor WorkspaceService to Use Prisma

**Files:**
- Modify: `packages/bff/src/workspace/workspace.service.ts`
- Modify: `packages/bff/src/workspace/workspace.module.ts`

**Step 1: Rewrite WorkspaceService**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {}

  async createWorkspace(name: string, ownerAddress: string) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');

    const tx = this.txBuilder.buildCreateWorkspaceTx(name, globalConfigId);
    const result = await this.suiClient.executeTransaction(tx);

    const wsEvent = result.events?.find(
      (e: any) => e.type.includes('::workspace::WorkspaceCreated'),
    );
    const suiObjectId = wsEvent?.parsedJson?.workspace_id ?? null;

    const workspace = await this.prisma.workspace.create({
      data: { suiObjectId, name, ownerAddress },
    });

    // Auto-add owner as admin member (roleLevel=3, permissions=31 = all)
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        address: ownerAddress,
        roleLevel: 3,
        permissions: 31,
      },
    });

    return { success: true, workspace };
  }

  async listUserWorkspaces(address: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { address },
      include: { workspace: true },
    });

    return {
      workspaces: members.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role_level: m.roleLevel,
        permissions: m.permissions,
      })),
    };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      owner_address: workspace.ownerAddress,
      member_count: workspace._count.members,
      created_at: workspace.createdAt,
    };
  }

  async addMember(workspaceId: string, memberAddress: string, roleLevel: number, permissions: number) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildAddMemberTx(
      globalConfigId, workspaceId, adminCapId,
      memberAddress, roleLevel, permissions,
    );

    const result = await this.suiClient.executeTransaction(tx);

    const member = await this.prisma.workspaceMember.create({
      data: { workspaceId, address: memberAddress, roleLevel, permissions },
    });

    return { success: true, member, txDigest: result.digest };
  }

  async removeMember(workspaceId: string, memberAddress: string) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID');
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID');

    const tx = this.txBuilder.buildRemoveMemberTx(
      globalConfigId, workspaceId, adminCapId, memberAddress,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.workspaceMember.delete({
      where: { workspaceId_address: { workspaceId, address: memberAddress } },
    });

    return { success: true, txDigest: result.digest };
  }
}
```

**Step 2: Update WorkspaceModule**

```typescript
import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, SuiClientService, TxBuilderService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
```

**Step 3: Commit**

```bash
git add packages/bff/src/workspace/
git commit -m "feat(bff): refactor WorkspaceService to use Prisma, remove mock data"
```

---

### Task 10: Type-Check & Verify Build

**Step 1: Run TypeScript type-check**

```bash
cd packages/bff && npx tsc --noEmit
```
Expected: No type errors (all `@ts-nocheck` removed from refactored services).

**Step 2: Fix any type errors**

If errors appear, fix them. Common ones:
- Missing TxBuilder methods (e.g. `buildUpdateProfileTagsTx` not in tx-builder.service.ts) — add stubs
- Prisma client not generated — run `npx prisma generate`

**Step 3: Verify build**

```bash
cd packages/bff && pnpm run build
```
Expected: Build succeeds.

**Step 4: Commit any fixes**

```bash
git add packages/bff/
git commit -m "fix(bff): resolve type errors from Prisma migration"
```
