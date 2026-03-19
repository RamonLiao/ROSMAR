# Spec Gap Implementation Plan

> 13 items from crm_spec_v1.md audit (2026-03-11)
> Priority: P0 = blocks other features, P1 = core spec, P2 = nice-to-have

---

## Phase 1: Infrastructure (先接好水管)

### 1.1 [P0] BullMQ Job Scheduling
- **問題**: 所有 job (`segment-eval`, `segment-refresh`, `sync-onchain`, `campaign-scheduler`, `sla-checker`, `vault-expiry`, `gdpr-cleanup`, `score-recalc`) 都有 `// TODO: Initialize BullMQ queue`，沒有實際排程
- **影響**: Segment evaluation、Vault expiry、Campaign scheduling、SLA check 全部不會自動執行
- **實作**:
  1. `packages/bff/src/jobs/bull.module.ts` — 建立 `@nestjs/bullmq` 全域 module，連 Redis
  2. 每個 job service 改為 `@Processor('queue-name')` + `@OnWorkerEvent`
  3. 各 module 註冊 queue + 排程 (cron expression)
  4. 加 health check endpoint `/api/jobs/health`
- **檔案**: `packages/bff/src/jobs/*.ts`, `packages/bff/src/app.module.ts`
- **驗證**: `curl /api/jobs/health` 回傳各 queue 狀態；log 確認 job 有定時觸發

### 1.2 [P0] Segment Rule Evaluation (gRPC → Local)
- **問題**: `evaluateSegment()` 呼叫 gRPC stub 回空 `{}`，segment membership 永遠不會計算
- **影響**: Smart Segments 的 member list 永遠空的
- **實作**:
  1. 在 BFF 內實作 local rule evaluator（不等 Rust Core）
  2. `packages/bff/src/segment/evaluator/rule-evaluator.service.ts` — 解析 JSON rules，轉成 Prisma `where` clause
  3. 支援條件: `tag contains`, `tier equals`, `engagement_score >=`, `wallet_chain equals`, `created_after`
  4. `segment-eval.job.ts` 改呼叫 local evaluator
  5. 結果寫入 `SegmentMembership` table
- **檔案**: `packages/bff/src/segment/evaluator/`, `packages/bff/src/jobs/segment-eval.job.ts`
- **驗證**: 建 segment with rules → refresh → member list 正確匹配

---

## Phase 2: Identity & Data (身分識別補完)

### 2.1 [P1] SuiNS Resolution
- **問題**: `suins.service.ts` 的 `resolveNameToAddress()` 和 `resolveAddressToName()` 都是 stub (return null)
- **實作**:
  1. 用 `@mysten/sui` SDK 查詢 SuiNS Registry object
  2. Forward: name → SuiNS Registry lookup → address
  3. Reverse: address → SuiNS reverse lookup → name
  4. 加 cache (Redis, TTL 1hr)
- **檔案**: `packages/bff/src/blockchain/suins.service.ts`
- **驗證**: 輸入已註冊的 `.sui` name → 回傳正確 address；反向同理

### 2.2 [P1] SUI Token USD Price Oracle
- **問題**: `getSuiBalance()` hardcode `usdPrice: 0`，SUI 錢包 net worth 永遠 $0
- **實作**:
  1. `packages/bff/src/blockchain/price-oracle.service.ts` — 接 CoinGecko or Pyth price feed
  2. Cache price (Redis, TTL 5min)
  3. `BalanceAggregatorService.getSuiBalance()` 用 oracle price 計算 USD
- **檔案**: `packages/bff/src/blockchain/price-oracle.service.ts`, `balance-aggregator.service.ts`
- **驗證**: Profile net worth card 顯示 SUI 的 USD 估值 > $0

### 2.3 [P2] NFT Gallery Images & Metadata
- **問題**: Asset gallery 只顯示 collection name + count，沒有圖片/metadata
- **實作**:
  1. `ProfileService.getAssets()` 額外 fetch NFT metadata (用 `sui_getObject` + display fields)
  2. 回傳 `imageUrl`, `name`, `description` per NFT
  3. Frontend `asset-gallery.tsx` 加 image card grid (lazy load)
- **檔案**: `packages/bff/src/profile/profile.service.ts`, `packages/frontend/src/components/profile/asset-gallery.tsx`
- **驗證**: Profile assets tab 顯示 NFT 縮圖

### 2.4 [P2] HD Wallet Auto-Detection
- **問題**: 無法自動偵測同一 HD Wallet 衍生的多個地址
- **實作**:
  1. 新增 `WalletClusterService` — 用 on-chain funding pattern 分析 (共同 funding source)
  2. 或用 signature-based proof: 用戶簽 message 證明擁有多個地址
  3. 建議先做 signature proof（確定性高），funding analysis 當 Phase 2
- **檔案**: `packages/bff/src/profile/wallet-cluster.service.ts`
- **驗證**: 用戶簽名 2 個 address → 系統自動合併到同一 profile

---

## Phase 3: Escrow & Deals (交易室接線)

### 3.1 [P1] Escrow On-chain Fund TX
- **問題**: `fundEscrow()` 只改 Prisma，沒呼叫 Move contract `crm_escrow::escrow::fund()`
- **實作**:
  1. `EscrowService.fundEscrow()` 組 PTB: `escrow::fund<SUI>(escrow_obj, coin, clock)`
  2. 用 `TxBuilderService.buildAndExecute()` 送 TX
  3. Prisma update 改為 TX 成功後的 callback
  4. `SUI_DRY_RUN=true` 時跳過 TX，只改 Prisma（現行行為）
- **檔案**: `packages/bff/src/deal/escrow.service.ts`
- **驗證**: Fund escrow → Sui explorer 確認 escrow object state = FUNDED

### 3.2 [P1] Deal Room Access Gate (Seal)
- **問題**: Deal detail page 沒有 Seal 驗證閘門，任何人都能看 documents
- **實作**:
  1. Frontend: `deals/[id]/page.tsx` Documents tab 加 Seal decrypt gate
  2. 進入 Documents tab 前，呼叫 `sealDecrypt()` 驗證身分
  3. 只有 deal 的 payer/payee 錢包能通過
  4. 未授權 → 顯示 "Access Denied" + 說明
- **檔案**: `packages/frontend/src/app/(dashboard)/deals/[id]/page.tsx`, `components/deal/deal-documents.tsx`
- **驗證**: 以非 payer/payee 錢包存取 → 看到 Access Denied

### 3.3 [P2] Deal Won → Escrow Auto-Release
- **問題**: Deal stage 改到 "Closed Won" 時沒有自動觸發 escrow release
- **實作**:
  1. `DealEventListener` 監聽 deal stage change event
  2. 當 stage = `closed_won` && escrow state = `FUNDED` → 自動呼叫 `escrow.release(full_amount)`
  3. 發 notification 給 payer/payee
- **檔案**: `packages/bff/src/deal/deal-event.listener.ts`, `escrow.service.ts`
- **驗證**: Kanban 拖到 Closed Won → escrow auto-release → state = COMPLETED

---

## Phase 4: Campaign Engine (行銷引擎補完)

### 4.1 [P1] Journey Builder Delay Steps
- **問題**: `WorkflowStep.delay` 欄位存在但 engine 同步執行，delay 沒作用
- **實作**:
  1. `WorkflowEngine.executeNextStep()` 遇到 delay > 0 時，排 BullMQ delayed job
  2. Job 到期後繼續執行下一步
  3. 需要 Phase 1.1 BullMQ 先完成
- **依賴**: Phase 1.1
- **檔案**: `packages/bff/src/campaign/workflow/workflow.engine.ts`
- **驗證**: 設定 10 秒 delay → 第一步立即執行 → 10 秒後第二步執行

### 4.2 [P1] Gas Station Auto-Sponsor
- **問題**: `GasSponsorListener` 只建 notification，沒自動呼叫 `sponsorTransaction()`
- **實作**:
  1. Listener 偵測到低餘額 wallet-connect 事件後，直接呼叫 `EnokiSponsorService.sponsorTransaction()`
  2. 加 rate limit (每 wallet 每天最多 N 次)
  3. 加 config: `GAS_SPONSOR_AUTO=true/false`, `GAS_SPONSOR_THRESHOLD=0.1`
  4. 結果寫 notification（成功/失敗）
- **檔案**: `packages/bff/src/blockchain/gas-sponsor.listener.ts`
- **驗證**: 新低餘額錢包連線 → 自動收到 gas sponsor TX

---

## Phase 5: Vault & Privacy (隱私層補完)

### 5.1 [P1] Vault On-chain Time-Lock
- **問題**: Vault expiry 只靠 server-side job（且 job 沒排程），Move contract 沒 enforce
- **實作**:
  1. Move: `crm_vault::vault` 加 `enforce_expiry()` entry function，過期後任何人可呼叫銷毀
  2. BFF: vault-expiry job（Phase 1.1 排程後）呼叫 `enforce_expiry()` on-chain
  3. 備選: 純 server-side 刪除（Phase 1.1 完成後就能運作）
- **依賴**: Phase 1.1
- **檔案**: `packages/move/crm_vault/sources/vault.move`, `packages/bff/src/jobs/vault-expiry.job.ts`
- **驗證**: 設定 1 min expiry → job 觸發後 → secret 被銷毀

---

## Phase 6: AI Agent (智能代理補完)

### 6.1 [P2] Yield Optimizer Agent
- **問題**: 完全沒有 code — 規格要求監控 Treasury 資金，建議最佳 DeFi 收益策略
- **實作**:
  1. `packages/bff/src/agent/yield/yield-optimizer.service.ts`
  2. 接 DeFi protocol APIs (Cetus, Turbos, Navi) 取 APY 資料
  3. LLM tool-calling: `get_pool_apys`, `get_treasury_balance`, `suggest_strategy`
  4. 回傳建議（不自動執行，需人工簽署）
  5. Frontend: 新增 `/treasury` 或嵌入 analytics page
- **檔案**: 新建 `packages/bff/src/agent/yield/`
- **驗證**: 查詢 "What's the best yield for 10K SUI?" → 回傳 protocol + APY + 建議

---

## Execution Order

```
Phase 1 (Infrastructure)     ← 最先做，其他 phase 依賴
  1.1 BullMQ                 ← P0, 阻塞 4.1, 5.1 + 所有 scheduled jobs
  1.2 Segment Evaluation     ← P0, Smart Segments 核心功能

Phase 2 (Identity)           ← 可平行
  2.1 SuiNS                  ← P1, 獨立
  2.2 Price Oracle           ← P1, 獨立
  2.3 NFT Gallery            ← P2, 獨立
  2.4 HD Wallet              ← P2, 獨立

Phase 3 (Escrow)             ← 可平行
  3.1 Escrow Fund TX         ← P1, 獨立
  3.2 Deal Room Gate         ← P1, 獨立
  3.3 Deal Won Auto-Release  ← P2, 依賴 3.1

Phase 4 (Campaign)           ← 依賴 Phase 1.1
  4.1 Delay Steps            ← P1, 依賴 1.1
  4.2 Gas Station            ← P1, 獨立

Phase 5 (Vault)              ← 依賴 Phase 1.1
  5.1 Time-Lock              ← P1, 依賴 1.1

Phase 6 (AI)                 ← 最後做
  6.1 Yield Optimizer        ← P2, 獨立，scope 最大
```

## Per-Chat Breakdown (建議拆法)

| Chat | Tasks | 預估複雜度 |
|------|-------|-----------|
| Chat A | 1.1 BullMQ 排程 | Medium — 改 8+ job files + 新增 bull module |
| Chat B | 1.2 Segment Rule Evaluator | Medium — 新建 evaluator + Prisma where 轉換 |
| Chat C | 2.1 SuiNS + 2.2 Price Oracle | Small — 兩個獨立 service，可同 chat |
| Chat D | 2.3 NFT Gallery + 2.4 HD Wallet | Small-Medium — frontend + BFF |
| Chat E | 3.1 Escrow Fund TX + 3.2 Deal Room Gate | Medium — Move PTB + Seal frontend |
| Chat F | 3.3 Deal Won Auto-Release + 4.2 Gas Station | Small — 兩個 event listener |
| Chat G | 4.1 Delay Steps | Small — WorkflowEngine + BullMQ delayed job |
| Chat H | 5.1 Vault Time-Lock | Small — Move + job wiring |
| Chat I | 6.1 Yield Optimizer | Large — 全新 agent + DeFi API 整合 |
