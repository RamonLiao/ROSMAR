# P3 Implementation Plan: AI, Automation & Ecosystem

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI agents, event-driven workflow triggers, multi-chain identity, social OAuth linking, gas auto-sponsorship, and broadcast publishing to ROSMAR CRM.

**Architecture:** 4 waves of parallel work. Wave 1 builds LLM foundation + event triggers + gas station. Wave 2 adds AI agents (analyst + content + action). Wave 3 adds multi-chain wallets + social OAuth. Wave 4 adds workflow actions/playbooks + broadcast module.

**Tech Stack:** NestJS 11, Prisma 7, Vercel AI SDK (`ai`), `@ai-sdk/anthropic`, `@ai-sdk/openai`, ethers v6, @bonfida/spl-name-service, Moralis/Ankr, EventEmitter2, Enoki SDK.

**Design doc:** `docs/plans/2026-03-07-p3-design.md`

**Existing patterns to follow:**
- BFF modules: see `packages/bff/src/vault/` for service + controller + module pattern
- Prisma: models in `packages/bff/prisma/schema.prisma`, @Global PrismaModule
- Frontend hooks: `packages/frontend/src/lib/hooks/use-*.ts` using react-query + `apiClient`
- Frontend pages: `packages/frontend/src/app/(dashboard)/` Next.js app router
- Workflow actions: `packages/bff/src/campaign/workflow/actions/*.action.ts`
- Event emission: `WebhookService` emits `indexer.event` + `indexer.event.${type}`
- Dry-run pattern: `execChainTx()` helper that skips TX build when `SUI_DRY_RUN=true`

---

## Wave 1: Automation Foundation (P3-1 + P3-2 + P3-8)

### Task 1: Prisma schema -- P3 models

**Files:**
- Modify: `packages/bff/prisma/schema.prisma` (append after Wave 2 models)

**Step 1: Add all P3 Prisma models**

Append to schema.prisma after the `// --- Wave 2 Models ---` section:

```prisma
// --- P3 Models -------------------------------------------------

model LlmUsageLog {
  id               String   @id @default(uuid())
  workspaceId      String   @map("workspace_id")
  userId           String   @map("user_id")
  agentType        String   @map("agent_type")
  model            String
  promptTokens     Int      @map("prompt_tokens")
  completionTokens Int      @map("completion_tokens")
  estimatedCostUsd Decimal  @map("estimated_cost_usd") @db.Decimal(10, 6)
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([workspaceId, createdAt])
  @@map("llm_usage_logs")
}

model WorkspaceAiConfig {
  workspaceId       String   @id @map("workspace_id")
  provider          String   @default("anthropic")
  apiKeyEncrypted   String?  @map("api_key_encrypted")
  monthlyQuotaUsd   Decimal  @default(10) @map("monthly_quota_usd") @db.Decimal(10, 2)
  usedQuotaUsd      Decimal  @default(0) @map("used_quota_usd") @db.Decimal(10, 2)
  quotaResetAt      DateTime @map("quota_reset_at")
  isEnabled         Boolean  @default(true) @map("is_enabled")

  @@map("workspace_ai_configs")
}

model CampaignTrigger {
  id            String  @id @default(uuid())
  campaignId    String  @map("campaign_id")
  triggerType   String  @map("trigger_type")
  triggerConfig Json    @map("trigger_config")
  isEnabled     Boolean @default(true) @map("is_enabled")

  campaign Campaign @relation(fields: [campaignId], references: [id])

  @@index([triggerType, isEnabled])
  @@map("campaign_triggers")
}

model ProfileWallet {
  id        String   @id @default(uuid())
  profileId String   @map("profile_id")
  chain     String
  address   String
  ensName   String?  @map("ens_name")
  snsName   String?  @map("sns_name")
  verified  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  profile Profile @relation(fields: [profileId], references: [id])

  @@unique([profileId, chain, address])
  @@index([address])
  @@map("profile_wallets")
}

model SocialLink {
  id                  String   @id @default(uuid())
  profileId           String   @map("profile_id")
  platform            String
  platformUserId      String   @map("platform_user_id")
  platformUsername     String?  @map("platform_username")
  oauthTokenEncrypted String?  @map("oauth_token_encrypted")
  verified            Boolean  @default(false)
  linkedAt            DateTime @default(now()) @map("linked_at")

  profile Profile @relation(fields: [profileId], references: [id])

  @@unique([profileId, platform])
  @@index([platform, platformUserId])
  @@map("social_links")
}

model Broadcast {
  id          String    @id @default(uuid())
  workspaceId String    @map("workspace_id")
  title       String
  content     String
  contentHtml String?   @map("content_html")
  channels    Json
  segmentId   String?   @map("segment_id")
  status      String    @default("draft")
  scheduledAt DateTime? @map("scheduled_at")
  sentAt      DateTime? @map("sent_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  workspace  Workspace          @relation(fields: [workspaceId], references: [id])
  deliveries BroadcastDelivery[]

  @@index([workspaceId, status])
  @@map("broadcasts")
}

model BroadcastDelivery {
  id                String    @id @default(uuid())
  broadcastId       String    @map("broadcast_id")
  channel           String
  platformMessageId String?   @map("platform_message_id")
  status            String    @default("pending")
  error             String?
  deliveredAt       DateTime? @map("delivered_at")
  createdAt         DateTime  @default(now()) @map("created_at")

  broadcast Broadcast @relation(fields: [broadcastId], references: [id])

  @@index([broadcastId, channel])
  @@map("broadcast_deliveries")
}
```

Also add relations to existing models:
- `Profile` model: add `wallets ProfileWallet[]` and `socialLinks SocialLink[]`
- `Campaign` model: add `triggers CampaignTrigger[]`
- `Workspace` model: add `broadcasts Broadcast[]`

**Step 2: Generate Prisma client**

```bash
cd packages/bff && npx prisma generate
```

Expected: Prisma client regenerated with new models.

**Step 3: Verify BFF compiles**

```bash
cd packages/bff && npx tsc --noEmit
```

Expected: Clean (no errors from schema changes since models are additive).

**Step 4: Commit**

```bash
git add packages/bff/prisma/schema.prisma
git commit -m "feat(schema): add P3 Prisma models (LLM, triggers, wallets, social, broadcast)"
```

---

### Task 2: Install P3 dependencies

**Files:**
- Modify: `packages/bff/package.json`

**Step 1: Install LLM + multi-chain deps in BFF**

```bash
cd packages/bff
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai
pnpm add ethers@^6
pnpm add @bonfida/spl-name-service @solana/web3.js
```

Note: Moralis/Ankr will be added in Wave 3 when implementing balance aggregation (need to evaluate free tier first).

**Step 2: Verify build**

```bash
cd packages/bff && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/bff/package.json pnpm-lock.yaml
git commit -m "chore: install P3 deps (ai sdk, ethers, solana)"
```

---

### Task 3: P3-1 LlmClientService -- API key resolution + provider setup

**Files:**
- Create: `packages/bff/src/agent/agent.module.ts`
- Create: `packages/bff/src/agent/llm-client.service.ts`
- Create: `packages/bff/src/agent/llm-client.service.spec.ts`
- Modify: `packages/bff/src/app.module.ts` (add AgentModule)

**Step 1: Write the failing test**

```typescript
// llm-client.service.spec.ts
import { Test } from '@nestjs/testing';
import { LlmClientService } from './llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('LlmClientService', () => {
  let service: LlmClientService;
  let prisma: { workspaceAiConfig: { findUnique: jest.fn } };

  beforeEach(async () => {
    prisma = { workspaceAiConfig: { findUnique: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        LlmClientService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                ANTHROPIC_API_KEY: 'platform-key-123',
                OPENAI_API_KEY: 'platform-oai-key',
              };
              return map[key] ?? '';
            },
          },
        },
      ],
    }).compile();

    service = module.get(LlmClientService);
  });

  it('should use platform key when workspace has no BYOK config', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue(null);
    const result = await service.resolveConfig('workspace-1');
    expect(result.provider).toBe('anthropic');
    expect(result.apiKey).toBe('platform-key-123');
  });

  it('should use BYOK key when workspace has config', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue({
      provider: 'openai',
      apiKeyEncrypted: 'byok-key-456', // In real impl, this would be Seal-encrypted
      isEnabled: true,
      monthlyQuotaUsd: 100,
      usedQuotaUsd: 5,
    });
    const result = await service.resolveConfig('workspace-1');
    expect(result.provider).toBe('openai');
    expect(result.apiKey).toBe('byok-key-456');
  });

  it('should reject when quota exceeded', async () => {
    prisma.workspaceAiConfig.findUnique.mockResolvedValue({
      provider: 'anthropic',
      apiKeyEncrypted: null,
      isEnabled: true,
      monthlyQuotaUsd: 10,
      usedQuotaUsd: 10.5,
    });
    await expect(service.resolveConfig('workspace-1')).rejects.toThrow('AI quota exceeded');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/bff && npx jest --testPathPattern=llm-client --no-coverage
```

Expected: FAIL (module not found)

**Step 3: Implement LlmClientService**

```typescript
// llm-client.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { generateText, streamText, LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: LanguageModel;
}

@Injectable()
export class LlmClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async resolveConfig(workspaceId: string): Promise<LlmConfig> {
    const config = await this.prisma.workspaceAiConfig.findUnique({
      where: { workspaceId },
    });

    // Check quota
    if (config && Number(config.usedQuotaUsd) >= Number(config.monthlyQuotaUsd)) {
      throw new ForbiddenException('AI quota exceeded for this workspace');
    }

    const provider = config?.provider ?? 'anthropic';
    const apiKey = config?.apiKeyEncrypted // TODO: Seal decrypt in production
      ?? this.getPlatformKey(provider);

    return {
      provider,
      apiKey,
      model: this.createModel(provider, apiKey),
    };
  }

  private getPlatformKey(provider: string): string {
    const keyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
    };
    return this.configService.get<string>(keyMap[provider] ?? 'ANTHROPIC_API_KEY', '');
  }

  private createModel(provider: string, apiKey: string): LanguageModel {
    if (provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      return openai('gpt-4o');
    }
    const anthropic = createAnthropic({ apiKey });
    return anthropic('claude-sonnet-4-20250514');
  }

  async generate(
    workspaceId: string,
    params: { system?: string; prompt: string; tools?: any },
  ) {
    const config = await this.resolveConfig(workspaceId);
    return generateText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
    });
  }

  async stream(
    workspaceId: string,
    params: { system?: string; prompt: string; tools?: any },
  ) {
    const config = await this.resolveConfig(workspaceId);
    return streamText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
    });
  }
}
```

```typescript
// agent.module.ts
import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { UsageTrackingService } from './usage-tracking.service';

@Module({
  providers: [LlmClientService, UsageTrackingService],
  exports: [LlmClientService, UsageTrackingService],
})
export class AgentModule {}
```

Add `AgentModule` to `app.module.ts` imports array.

**Step 4: Run test to verify it passes**

```bash
cd packages/bff && npx jest --testPathPattern=llm-client --no-coverage
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add packages/bff/src/agent/
git commit -m "feat(agent): LlmClientService with API key resolution and quota check"
```

---

### Task 4: P3-1 UsageTrackingService

**Files:**
- Create: `packages/bff/src/agent/usage-tracking.service.ts`
- Create: `packages/bff/src/agent/usage-tracking.service.spec.ts`

**Step 1: Write the failing test**

```typescript
// usage-tracking.service.spec.ts
import { Test } from '@nestjs/testing';
import { UsageTrackingService } from './usage-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      llmUsageLog: { create: jest.fn() },
      workspaceAiConfig: { upsert: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(UsageTrackingService);
  });

  it('should log usage and increment quota', async () => {
    prisma.llmUsageLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.workspaceAiConfig.upsert.mockResolvedValue({});

    await service.trackUsage({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'analyst',
      model: 'claude-sonnet-4-20250514',
      promptTokens: 1000,
      completionTokens: 500,
    });

    expect(prisma.llmUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        agentType: 'analyst',
        promptTokens: 1000,
        completionTokens: 500,
      }),
    });
    expect(prisma.workspaceAiConfig.upsert).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify fails, implement, verify passes**

Implementation: create `UsageTrackingService` that:
- Accepts usage data (tokens, model)
- Calculates estimated cost based on model pricing table
- Creates `LlmUsageLog` record
- Upserts `WorkspaceAiConfig` to increment `usedQuotaUsd`

**Step 3: Commit**

```bash
git commit -m "feat(agent): UsageTrackingService with cost estimation"
```

---

### Task 5: P3-1 Agent settings API + frontend

**Files:**
- Create: `packages/bff/src/agent/agent.controller.ts`
- Create: `packages/frontend/src/lib/hooks/use-ai-settings.ts`
- Modify: `packages/frontend/src/app/(dashboard)/settings/workspace/page.tsx` (add AI config section)

**Step 1: Implement agent controller**

Endpoints:
- `GET /agent/config` -- get workspace AI config
- `PUT /agent/config` -- update provider, API key (BYOK), quota
- `GET /agent/usage` -- get usage logs for current month

**Step 2: Frontend hook + settings UI**

Add "AI Configuration" section to workspace settings page:
- Provider dropdown (Anthropic / OpenAI)
- API key input (optional, for BYOK)
- Monthly quota display + usage bar
- Enable/disable toggle

**Step 3: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=agent --no-coverage
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(agent): AI settings API + workspace settings UI"
```

---

### Task 6: P3-2 TriggerMatcherService -- event listener

**Files:**
- Create: `packages/bff/src/campaign/trigger/trigger-matcher.service.ts`
- Create: `packages/bff/src/campaign/trigger/trigger-matcher.service.spec.ts`

**Step 1: Write the failing test**

```typescript
// trigger-matcher.service.spec.ts
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TriggerMatcherService } from './trigger-matcher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';

describe('TriggerMatcherService', () => {
  let service: TriggerMatcherService;
  let prisma: any;
  let workflowEngine: any;

  beforeEach(async () => {
    prisma = {
      campaignTrigger: { findMany: jest.fn() },
      campaign: { findUnique: jest.fn() },
      segmentMembership: { findMany: jest.fn() },
    };
    workflowEngine = { startWorkflow: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TriggerMatcherService,
        EventEmitter2,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngine, useValue: workflowEngine },
      ],
    }).compile();

    service = module.get(TriggerMatcherService);
  });

  it('should match nft_minted trigger and start workflow', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'test-collection' },
        isEnabled: true,
        campaign: {
          id: 'campaign-1',
          status: 'active',
          workflowSteps: [{ type: 'send_telegram', config: {} }],
        },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
      'campaign-1',
      expect.any(Array),
      ['profile-1'],
    );
  });

  it('should NOT trigger when collection does not match', async () => {
    prisma.campaignTrigger.findMany.mockResolvedValue([
      {
        id: 'trigger-1',
        campaignId: 'campaign-1',
        triggerType: 'nft_minted',
        triggerConfig: { collection: 'other-collection' },
        isEnabled: true,
        campaign: { id: 'campaign-1', status: 'active', workflowSteps: [] },
      },
    ]);

    await service.handleIndexerEvent({
      event_id: 'evt-1',
      event_type: 'nft_minted',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { collection: 'test-collection' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
  });
});
```

**Step 2: Implement TriggerMatcherService**

```typescript
// trigger-matcher.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { IndexerEventDto } from '../../webhook/indexer-event.dto';

@Injectable()
export class TriggerMatcherService {
  private readonly logger = new Logger(TriggerMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
  ) {}

  @OnEvent('indexer.event')
  async handleIndexerEvent(event: IndexerEventDto): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: { triggerType: event.event_type, isEnabled: true },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      if (trigger.campaign.status !== 'active') continue;
      if (!this.matchesConfig(trigger.triggerConfig as any, event)) continue;

      const profileIds = event.profile_id ? [event.profile_id] : [];
      if (profileIds.length === 0) continue;

      this.logger.log(
        `Trigger matched: ${trigger.id} -> campaign ${trigger.campaignId}`,
      );

      await this.workflowEngine.startWorkflow(
        trigger.campaignId,
        trigger.campaign.workflowSteps as any[],
        profileIds,
      );
    }
  }

  private matchesConfig(config: Record<string, any>, event: IndexerEventDto): boolean {
    // Match each config key against event data
    for (const [key, value] of Object.entries(config)) {
      if ((event.data as any)?.[key] !== value) return false;
    }
    return true;
  }
}
```

**Step 3: Run tests, commit**

```bash
cd packages/bff && npx jest --testPathPattern=trigger-matcher --no-coverage
git commit -m "feat(campaign): TriggerMatcherService listens to indexer events"
```

---

### Task 7: P3-2 SegmentDiffJob -- segment_entered/exited triggers

**Files:**
- Create: `packages/bff/src/jobs/segment-diff.job.ts`
- Create: `packages/bff/src/jobs/segment-diff.job.spec.ts`
- Modify: `packages/bff/src/jobs/jobs.module.ts` (add SegmentDiffJob)

**Step 1: Write the failing test**

Test that the job:
1. Queries current segment memberships
2. Compares with previous snapshot
3. Emits `segment_entered` for new members
4. Emits `segment_exited` for removed members

**Step 2: Implement SegmentDiffJob**

- Runs on cron (every 5 minutes via `@Cron`)
- For each segment with active campaign triggers of type `segment_entered` or `segment_exited`:
  - Get current membership set
  - Compare with `SegmentMembership.joinedAt` to detect new entries
  - Emit events via EventEmitter2
- The TriggerMatcherService picks these up (add `@OnEvent('segment.entered')` handler)

**Step 3: Run tests, commit**

```bash
git commit -m "feat(jobs): SegmentDiffJob emits segment_entered/exited events"
```

---

### Task 8: P3-2 Campaign trigger CRUD API + frontend

**Files:**
- Modify: `packages/bff/src/campaign/campaign.controller.ts` (add trigger endpoints)
- Modify: `packages/bff/src/campaign/campaign.service.ts` (add trigger CRUD)
- Modify: `packages/bff/src/campaign/campaign.module.ts` (add TriggerMatcherService)
- Create: `packages/frontend/src/components/campaign/trigger-node-editor.tsx`
- Modify: `packages/frontend/src/lib/hooks/use-campaigns.ts` (add trigger hooks)

**Endpoints:**
- `POST /campaigns/:id/triggers` -- add trigger to campaign
- `GET /campaigns/:id/triggers` -- list triggers
- `DELETE /campaigns/:id/triggers/:triggerId` -- remove trigger
- `PATCH /campaigns/:id/triggers/:triggerId` -- update trigger config

**Frontend:**
- Trigger node editor component: dropdown for trigger type + config fields per type
- Condition node editor: field selector + operator + value
- Wire into campaign detail / workflow page

**Step: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=campaign --no-coverage
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(campaign): trigger CRUD API + trigger/condition node editor UI"
```

---

### Task 9: P3-8 GasSponsorListener

**Files:**
- Create: `packages/bff/src/blockchain/gas-sponsor.listener.ts`
- Create: `packages/bff/src/blockchain/gas-sponsor.listener.spec.ts`
- Modify: `packages/bff/src/blockchain/blockchain.module.ts` (add listener)

**Step 1: Write the failing test**

```typescript
// gas-sponsor.listener.spec.ts
import { Test } from '@nestjs/testing';
import { GasSponsorListener } from './gas-sponsor.listener';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from './sui.client';
import { EnokiSponsorService } from './enoki-sponsor.service';
import { ConfigService } from '@nestjs/config';

describe('GasSponsorListener', () => {
  let listener: GasSponsorListener;
  let suiClient: any;
  let prisma: any;

  beforeEach(async () => {
    suiClient = { getBalance: jest.fn() };
    prisma = {
      notification: { create: jest.fn() },
      workspace: { findUnique: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        GasSponsorListener,
        { provide: SuiClientService, useValue: suiClient },
        { provide: PrismaService, useValue: prisma },
        { provide: EnokiSponsorService, useValue: { isEnabled: true } },
        {
          provide: ConfigService,
          useValue: { get: () => 'true' },
        },
      ],
    }).compile();

    listener = module.get(GasSponsorListener);
  });

  it('should flag low-balance wallet for sponsorship', async () => {
    suiClient.getBalance.mockResolvedValue({ totalBalance: '50000000' }); // 0.05 SUI
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      // gasSponsorEnabled: true, gasSponsorThreshold: 0.1
    });

    await listener.handleWalletConnected({
      event_type: 'wallet_connected',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { workspaceId: 'ws-1' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'gas_sponsor_flagged',
      }),
    });
  });
});
```

**Step 2: Implement GasSponsorListener**

- `@OnEvent('indexer.event.wallet_connected')` handler
- Checks workspace gas sponsor settings (from config or workspace metadata)
- Queries Sui balance via gRPC (`SuiClientService`)
- If balance < threshold, creates notification + marks profile for sponsored TX
- Does NOT send SUI -- Enoki sponsor mode kicks in on next TX

**Step 3: Run tests, commit**

```bash
cd packages/bff && npx jest --testPathPattern=gas-sponsor --no-coverage
git commit -m "feat(blockchain): GasSponsorListener flags low-balance wallets"
```

---

### Task 10: P3-8 Gas station workspace settings UI

**Files:**
- Modify: `packages/frontend/src/app/(dashboard)/settings/workspace/page.tsx`
- Create: `packages/frontend/src/lib/hooks/use-gas-settings.ts`

**Step 1: Add gas station settings section**

- Toggle: Enable/disable gas sponsorship
- Threshold input: minimum SUI balance (default 0.1)
- Daily limit input: max sponsored TXs per day
- Save to workspace metadata via existing workspace update API

**Step 2: Test + commit**

```bash
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(frontend): gas station settings in workspace config"
```

---

### Task 11: Wave 1 integration test + tsc check

**Step 1: Run full BFF test suite**

```bash
cd packages/bff && npx jest --no-coverage
```

**Step 2: Run full frontend test suite**

```bash
cd packages/frontend && npx vitest run
```

**Step 3: TypeScript check both packages**

```bash
cd packages/bff && npx tsc --noEmit
cd packages/frontend && npx tsc --noEmit
```

**Step 4: Commit any fixes**

```bash
git commit -m "fix: resolve Wave 1 integration issues"
```

---

## Wave 2: AI Agents (P3-3 + P3-4)

> Depends on: Wave 1 Task 3-4 (AgentModule + LlmClientService)

### Task 12: P3-3 AnalystAgent -- NL to Prisma query

**Files:**
- Create: `packages/bff/src/agent/analyst/analyst.service.ts`
- Create: `packages/bff/src/agent/analyst/analyst.service.spec.ts`
- Create: `packages/bff/src/agent/analyst/analyst.controller.ts`

**Step 1: Write the failing test**

Test that analyst service:
1. Receives NL query "show me profiles with engagement > 80"
2. Calls LLM with tool definitions for Prisma-safe operations
3. Executes the generated query (mocked)
4. Returns formatted results

**Step 2: Implement AnalystService**

Key design:
- System prompt defines available data model (Profile fields, Segment, WalletEvent, etc.)
- LLM tools: `query_profiles`, `aggregate_data`, `group_by_field`
- Each tool maps to a safe Prisma operation (read-only)
- Tool results are formatted + optional chart config generated

```typescript
// Prompt template (simplified)
const ANALYST_SYSTEM = `You are an analytics agent for a Web3 CRM.
Available data: profiles (tags, tier, engagementScore, primaryAddress),
segments, wallet_events (eventType, amount, token), engagement_snapshots.
Use the provided tools to query data. NEVER mutate data.`;
```

**Step 3: Controller endpoint**

```
POST /agents/analyst/query
Body: { query: string }
Response: { intent: string, data: any[], chartConfig?: any }
```

**Step 4: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=analyst --no-coverage
git commit -m "feat(agent): AnalystAgent NL-to-Prisma query"
```

---

### Task 13: P3-3 Analyst frontend -- chat-style query UI

**Files:**
- Create: `packages/frontend/src/components/analytics/analyst-chat.tsx`
- Create: `packages/frontend/src/lib/hooks/use-analyst.ts`
- Modify: `packages/frontend/src/app/(dashboard)/analytics/page.tsx` (add chat panel)

**Step 1: Implement chat UI**

- Input bar at bottom, messages scroll up
- User messages + AI response cards
- Response card shows data table + optional chart
- Loading state while LLM processes

**Step 2: Test + commit**

```bash
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(frontend): analyst chat UI in analytics page"
```

---

### Task 14: P3-4 ContentAgent

**Files:**
- Create: `packages/bff/src/agent/content/content.service.ts`
- Create: `packages/bff/src/agent/content/content.service.spec.ts`
- Create: `packages/bff/src/agent/content/content.controller.ts`

**Step 1: Write the failing test**

Test that content service:
1. Receives segment description + channel + tone
2. Calls LLM with content generation prompt
3. Returns channel-formatted copy

**Step 2: Implement ContentService**

```
POST /agents/content/generate
Body: { segmentDescription: string, channel: 'telegram'|'discord'|'email'|'x', tone: string }
Response: { content: string, subject?: string }
```

System prompt includes channel-specific formatting rules:
- Telegram: markdown, max 4096 chars, emoji encouraged
- Discord: markdown, embed-friendly
- X: max 280 chars, hashtag suggestions
- Email: subject line + HTML body

**Step 3: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=content --no-coverage
git commit -m "feat(agent): ContentAgent generates channel-specific marketing copy"
```

---

### Task 15: P3-4 ActionAgent -- plan + execute

**Files:**
- Create: `packages/bff/src/agent/action/action.service.ts`
- Create: `packages/bff/src/agent/action/action.service.spec.ts`
- Create: `packages/bff/src/agent/action/action.controller.ts`

**Step 1: Write the failing test**

Test that action service:
1. Receives NL instruction "airdrop NFT to all whale users"
2. LLM generates structured plan: { targetSegment, actions, estimatedCost }
3. Plan is returned for human review (NOT auto-executed)
4. On `execute` call, validates plan and delegates to WorkflowEngine

**Step 2: Implement ActionService**

```
POST /agents/action/plan
Body: { instruction: string }
Response: { planId: string, targetSegment: string, actions: Action[], estimatedCost: string }

POST /agents/action/execute
Body: { planId: string }
Response: { success: boolean, campaignId: string }
```

Safety: `execute` requires the plan to have been created in the same session. No stale plan execution.

**Step 3: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=action --no-coverage
git commit -m "feat(agent): ActionAgent plan + human-approved execute"
```

---

### Task 16: P3-4 Frontend -- AI buttons in campaign + broadcast

**Files:**
- Create: `packages/frontend/src/components/campaign/ai-suggest-button.tsx`
- Create: `packages/frontend/src/components/agent/action-plan-wizard.tsx`
- Create: `packages/frontend/src/lib/hooks/use-content-agent.ts`
- Create: `packages/frontend/src/lib/hooks/use-action-agent.ts`

**Step 1: Implement components**

- "AI Suggest Copy" button: calls content agent API, fills in message body
- Action plan wizard: input NL -> show plan -> confirm -> execute
- Wire into campaign create page + (future) broadcast editor

**Step 2: Test + commit**

```bash
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(frontend): AI suggest copy button + action plan wizard"
```

---

### Task 17: Wave 2 integration test + tsc check

Same pattern as Task 11: run all tests, tsc check, fix issues, commit.

---

## Wave 3: Multi-chain + Social Identity (P3-5 + P3-6)

### Task 18: P3-5 EvmResolverService -- ENS lookup

**Files:**
- Create: `packages/bff/src/blockchain/evm-resolver.service.ts`
- Create: `packages/bff/src/blockchain/evm-resolver.service.spec.ts`

**Step 1: Write the failing test**

```typescript
describe('EvmResolverService', () => {
  it('should resolve ENS name to address', async () => {
    // Mock ethers provider.resolveName
    const result = await service.resolveEns('vitalik.eth');
    expect(result).toMatch(/^0x/);
  });

  it('should reverse-resolve address to ENS name', async () => {
    const result = await service.lookupAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result).toBe('vitalik.eth');
  });
});
```

**Step 2: Implement using ethers v6**

```typescript
import { JsonRpcProvider } from 'ethers';

@Injectable()
export class EvmResolverService {
  private provider: JsonRpcProvider;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get('EVM_RPC_URL', 'https://eth.llamarpc.com');
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  async resolveEns(ensName: string): Promise<string | null> {
    return this.provider.resolveName(ensName);
  }

  async lookupAddress(address: string): Promise<string | null> {
    return this.provider.lookupAddress(address);
  }
}
```

**Step 3: Test + commit**

```bash
git commit -m "feat(blockchain): EvmResolverService for ENS lookup"
```

---

### Task 19: P3-5 SolanaResolverService -- SNS lookup

**Files:**
- Create: `packages/bff/src/blockchain/solana-resolver.service.ts`
- Create: `packages/bff/src/blockchain/solana-resolver.service.spec.ts`

**Step 1: Implement using @bonfida/spl-name-service**

Resolves `.sol` names to Solana addresses and reverse lookup.

**Step 2: Test + commit**

```bash
git commit -m "feat(blockchain): SolanaResolverService for SNS lookup"
```

---

### Task 20: P3-5 BalanceAggregatorService -- multi-chain balances

**Files:**
- Create: `packages/bff/src/blockchain/balance-aggregator.service.ts`
- Create: `packages/bff/src/blockchain/balance-aggregator.service.spec.ts`

**Step 1: Install aggregator SDK**

```bash
cd packages/bff && pnpm add moralis
```

(Or `@ankr.js/core` -- evaluate free tier at implementation time)

**Step 2: Implement**

```typescript
@Injectable()
export class BalanceAggregatorService {
  // Sui balance: use existing SuiJsonRpcClient (gRPC)
  async getSuiBalance(address: string): Promise<TokenBalance[]> { ... }

  // EVM + Solana: use Moralis/Ankr
  async getEvmBalances(address: string): Promise<TokenBalance[]> { ... }
  async getSolanaBalances(address: string): Promise<TokenBalance[]> { ... }

  // Aggregate across all wallets for a profile
  async getNetWorth(profileId: string): Promise<{ totalUsd: number, breakdown: ChainBalance[] }> { ... }
}
```

**Step 3: Test + commit**

```bash
git commit -m "feat(blockchain): BalanceAggregatorService multi-chain balances"
```

---

### Task 21: P3-5 Profile wallets API + frontend

**Files:**
- Modify: `packages/bff/src/profile/profile.controller.ts` (add wallet endpoints)
- Modify: `packages/bff/src/profile/profile.service.ts` (add wallet CRUD + net worth)
- Create: `packages/frontend/src/components/profile/wallets-tab.tsx`
- Create: `packages/frontend/src/components/profile/net-worth-card.tsx`
- Create: `packages/frontend/src/lib/hooks/use-profile-wallets.ts`
- Modify: `packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx` (add Wallets tab)

**Endpoints:**
- `POST /profiles/:id/wallets` -- add wallet (chain + address)
- `GET /profiles/:id/wallets` -- list wallets with resolved names
- `DELETE /profiles/:id/wallets/:walletId` -- remove wallet
- `GET /profiles/:id/net-worth` -- aggregated balance across all chains

**Frontend:**
- Wallets tab: list of wallets per chain, add/remove buttons
- Net Worth card: total USD value + per-chain breakdown

**Step: Test + commit**

```bash
git commit -m "feat(profile): multi-chain wallets API + wallets tab + net worth card"
```

---

### Task 22: P3-6 SocialLinkService -- Discord OAuth2

**Files:**
- Create: `packages/bff/src/social/social-link.service.ts`
- Create: `packages/bff/src/social/social-link.service.spec.ts`
- Create: `packages/bff/src/social/social-link.controller.ts`
- Create: `packages/bff/src/social/social.module.ts`
- Create: `packages/bff/src/social/adapters/discord-oauth.adapter.ts`

**Step 1: Implement Discord OAuth2 flow**

1. `GET /social/discord/auth-url` -- returns Discord OAuth2 authorize URL
2. `GET /social/discord/callback?code=...` -- exchange code for token, store encrypted
3. `DELETE /social/:profileId/discord` -- unlink

Token is encrypted before storage (Seal in production, AES placeholder for dev).

**Step 2: Test + commit**

```bash
git commit -m "feat(social): Discord OAuth2 link/unlink with encrypted token storage"
```

---

### Task 23: P3-6 SocialLinkService -- Telegram + X + Apple

**Files:**
- Create: `packages/bff/src/social/adapters/telegram-oauth.adapter.ts`
- Create: `packages/bff/src/social/adapters/x-oauth.adapter.ts`
- Modify: `packages/bff/src/social/social-link.service.ts` (add platform adapters)

**Step 1: Implement remaining platforms**

- Telegram: Bot Login Widget verification (hash check)
- X (Twitter): OAuth2 PKCE flow
- Apple: Leverage existing Enoki ZkLogin -- create/link profile on OAuth callback

**Step 2: Test + commit**

```bash
git commit -m "feat(social): Telegram + X + Apple social linking"
```

---

### Task 24: P3-6 Social tab frontend

**Files:**
- Create: `packages/frontend/src/components/profile/social-tab.tsx`
- Create: `packages/frontend/src/lib/hooks/use-social-links.ts`
- Modify: `packages/frontend/src/app/(dashboard)/profiles/[id]/page.tsx` (add Social tab)

**Step 1: Implement Social tab**

- Per-platform card: icon + username + link/unlink button
- Discord/X: opens OAuth popup
- Telegram: embed Login Widget
- Apple: shows ZkLogin status
- Verified badge on linked accounts

**Step 2: Test + commit**

```bash
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(frontend): social linking tab in profile detail"
```

---

### Task 25: Wave 3 integration test + tsc check

Same pattern as Task 11.

---

## Wave 4: Workflows + Broadcasting (P3-7 + P3-9)

> Depends on: Wave 3 (P3-6 social tokens for actions, P3-4 content agent for broadcast)

### Task 26: P3-7 New workflow actions -- grant_discord_role + issue_poap

**Files:**
- Create: `packages/bff/src/campaign/workflow/actions/grant-discord-role.action.ts`
- Create: `packages/bff/src/campaign/workflow/actions/issue-poap.action.ts`
- Create: `packages/bff/src/campaign/workflow/actions/ai-generate-content.action.ts`
- Modify: `packages/bff/src/campaign/workflow/workflow.engine.ts` (register new actions)
- Modify: `packages/bff/src/campaign/campaign.module.ts` (add new action providers)

**Step 1: Write tests for each action**

Each action follows the existing interface: `execute(profileId: string, config: any): Promise<void>`

- `grant_discord_role`: lookup SocialLink for profile -> use OAuth token -> Discord API `PUT /guilds/:id/members/:userId/roles/:roleId`
- `issue_poap`: build Sui TX to mint badge/POAP NFT -> execute via TxBuilder
- `ai_generate_content`: call ContentAgent -> populate step config with generated content -> pass to next action

**Step 2: Register in WorkflowEngine constructor**

```typescript
this.actions.set('grant_discord_role', this.grantDiscordRoleAction);
this.actions.set('issue_poap', this.issuePoapAction);
this.actions.set('ai_generate_content', this.aiGenerateContentAction);
```

**Step 3: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=workflow --no-coverage
git commit -m "feat(campaign): new workflow actions (discord role, POAP, AI content)"
```

---

### Task 27: P3-7 Playbook templates API + picker UI

**Files:**
- Create: `packages/bff/src/campaign/template/playbook-templates.ts`
- Modify: `packages/bff/src/campaign/campaign.controller.ts` (add `GET /templates/playbooks`)
- Create: `packages/frontend/src/components/campaign/playbook-picker.tsx`

**Step 1: Define template constants**

```typescript
export const PLAYBOOK_TEMPLATES = [
  {
    id: 'nft-welcome',
    name: 'NFT Welcome',
    description: 'Welcome new NFT holders with a message and Discord role',
    trigger: { type: 'nft_minted', config: {} },
    workflowSteps: [
      { type: 'delay', config: { ms: 3600000 } },
      { type: 'send_telegram', config: { template: 'Welcome to {{collection}}!' } },
      { type: 'grant_discord_role', config: { roleName: 'Holder' } },
    ],
  },
  // ... DeFi Activation, DAO Voting, Membership Tier
];
```

**Step 2: Frontend picker**

- Grid of playbook cards in campaign create flow
- Click to pre-fill trigger + workflow steps
- Editable after selection

**Step 3: Test + commit**

```bash
git commit -m "feat(campaign): playbook templates API + picker UI"
```

---

### Task 28: P3-7 Campaign stats endpoint + UI

**Files:**
- Modify: `packages/bff/src/campaign/campaign.service.ts` (enhance `getCampaignStats`)
- Modify: `packages/frontend/src/components/campaign/campaign-stats.tsx` (add per-node metrics)

**Step 1: Enhance stats endpoint**

```
GET /campaigns/:id/stats
Response: {
  totalEntries: number,
  completedCount: number,
  failedCount: number,
  perStep: [{ stepIndex, actionType, successCount, failCount }],
  conversionRate: number,
}
```

Query from `WorkflowExecution` + `WorkflowActionLog` tables.

**Step 2: Frontend stats card**

- Funnel visualization: per-step success/fail counts
- Overall conversion rate
- Error summary

**Step 3: Test + commit**

```bash
git commit -m "feat(campaign): enhanced campaign stats with per-node metrics"
```

---

### Task 29: P3-9 BroadcastModule -- service + controller

**Files:**
- Create: `packages/bff/src/broadcast/broadcast.module.ts`
- Create: `packages/bff/src/broadcast/broadcast.service.ts`
- Create: `packages/bff/src/broadcast/broadcast.service.spec.ts`
- Create: `packages/bff/src/broadcast/broadcast.controller.ts`
- Modify: `packages/bff/src/app.module.ts` (add BroadcastModule)

**Step 1: Write the failing test**

```typescript
describe('BroadcastService', () => {
  it('should create a draft broadcast', async () => {
    const result = await service.create('ws-1', {
      title: 'New feature launch',
      content: 'We just shipped...',
      channels: ['discord', 'telegram'],
    });
    expect(result.status).toBe('draft');
    expect(prisma.broadcast.create).toHaveBeenCalled();
  });

  it('should send broadcast to all channels', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 'bc-1',
      channels: ['discord', 'telegram'],
      content: 'Hello!',
      status: 'draft',
    });

    await service.send('bc-1');

    expect(discordAdapter.send).toHaveBeenCalled();
    expect(telegramAdapter.send).toHaveBeenCalled();
    expect(prisma.broadcast.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
  });
});
```

**Step 2: Implement CRUD + send**

Endpoints:
- `POST /broadcasts` -- create draft
- `PATCH /broadcasts/:id` -- edit
- `POST /broadcasts/:id/send` -- send immediately
- `POST /broadcasts/:id/schedule` -- schedule for later
- `GET /broadcasts` -- list with delivery stats
- `GET /broadcasts/:id/analytics` -- per-channel delivery stats

**Step 3: Test + commit**

```bash
cd packages/bff && npx jest --testPathPattern=broadcast --no-coverage
git commit -m "feat(broadcast): BroadcastModule CRUD + send + schedule"
```

---

### Task 30: P3-9 Channel adapters -- Telegram + Discord + X

**Files:**
- Create: `packages/bff/src/broadcast/adapters/channel-adapter.interface.ts`
- Create: `packages/bff/src/broadcast/adapters/telegram-channel.adapter.ts`
- Create: `packages/bff/src/broadcast/adapters/discord-channel.adapter.ts`
- Create: `packages/bff/src/broadcast/adapters/x-channel.adapter.ts`
- Create: `packages/bff/src/broadcast/adapters/channel-adapter.registry.ts`

**Step 1: Define interface**

```typescript
export interface ChannelAdapter {
  readonly channel: string;
  send(content: string, config: Record<string, any>): Promise<{ messageId: string }>;
}
```

**Step 2: Implement adapters**

- Telegram: Bot API `sendMessage` to chat/channel ID (workspace config)
- Discord: Bot API `POST /channels/:id/messages` (workspace config for channel ID)
- X: X API v2 `POST /tweets` (uses workspace-level OAuth token or BYOK)

**Step 3: Registry**

```typescript
@Injectable()
export class ChannelAdapterRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter) { this.adapters.set(adapter.channel, adapter); }
  get(channel: string) { return this.adapters.get(channel); }
}
```

**Step 4: Test + commit**

```bash
git commit -m "feat(broadcast): channel adapters for Telegram, Discord, X"
```

---

### Task 31: P3-9 Broadcast scheduling job

**Files:**
- Create: `packages/bff/src/jobs/broadcast-send.job.ts`
- Modify: `packages/bff/src/jobs/jobs.module.ts` (add BroadcastSendJob)

**Step 1: Implement cron job**

- Runs every minute
- Queries broadcasts with `status: 'scheduled'` and `scheduledAt <= now()`
- Calls `BroadcastService.send()` for each
- Updates status to `sending` -> `sent` or `failed`

**Step 2: Test + commit**

```bash
git commit -m "feat(jobs): BroadcastSendJob for scheduled broadcasts"
```

---

### Task 32: P3-9 Broadcast frontend -- page + editor

**Files:**
- Create: `packages/frontend/src/app/(dashboard)/broadcasts/page.tsx`
- Create: `packages/frontend/src/app/(dashboard)/broadcasts/[id]/page.tsx`
- Create: `packages/frontend/src/components/broadcast/broadcast-editor.tsx`
- Create: `packages/frontend/src/components/broadcast/channel-picker.tsx`
- Create: `packages/frontend/src/components/broadcast/broadcast-analytics.tsx`
- Create: `packages/frontend/src/lib/hooks/use-broadcasts.ts`
- Modify sidebar navigation to add Broadcasts link

**Step 1: List page**

- Table of broadcasts: title, channels, status, sent date, delivery stats
- Create button -> new broadcast editor

**Step 2: Editor page**

- Rich text editor for content (can use textarea for MVP, upgrade to tiptap later)
- Channel picker (checkboxes: Discord / Telegram / X)
- Segment selector (optional)
- "AI Generate" button (calls P3-4 ContentAgent)
- Preview per channel
- Send now / Schedule buttons

**Step 3: Analytics view**

- Per-channel delivery status (delivered / failed counts)
- Sent timestamp

**Step 4: Test + commit**

```bash
cd packages/frontend && npx vitest run --reporter=verbose
git commit -m "feat(frontend): broadcast list + editor + analytics pages"
```

---

### Task 33: Wave 4 integration test + tsc check

Same pattern as Task 11.

---

## Final: Cross-wave integration

### Task 34: Full test suite + final tsc check

```bash
cd packages/bff && npx jest --no-coverage
cd packages/frontend && npx vitest run
cd packages/bff && npx tsc --noEmit
cd packages/frontend && npx tsc --noEmit
```

### Task 35: Update progress.md + commit

Update `tasks/progress.md` with P3 completion status.

```bash
git commit -m "feat: P3 complete - AI agents, triggers, multi-chain, social, broadcast"
```

---

## Summary

| Wave | Tasks | Features | Key Files |
|------|-------|----------|-----------|
| Wave 1 | T1-T11 | P3-1 LLM + P3-2 Triggers + P3-8 Gas | `agent/`, `campaign/trigger/`, `blockchain/gas-sponsor` |
| Wave 2 | T12-T17 | P3-3 Analyst + P3-4 Content/Action | `agent/analyst/`, `agent/content/`, `agent/action/` |
| Wave 3 | T18-T25 | P3-5 Multi-chain + P3-6 Social | `blockchain/evm-*`, `blockchain/solana-*`, `social/` |
| Wave 4 | T26-T33 | P3-7 Playbooks + P3-9 Broadcast | `campaign/workflow/actions/`, `broadcast/` |

**Total: 35 tasks across 4 waves**

**Parallelization opportunities:**
- Wave 1: P3-1 (T3-T5) parallel with P3-2 (T6-T8), then P3-8 (T9-T10)
- Wave 2: P3-3 (T12-T13) parallel with P3-4 (T14-T16)
- Wave 3: P3-5 (T18-T21) parallel with P3-6 (T22-T24)
- Wave 4: P3-7 (T26-T28) parallel with P3-9 (T29-T32)
