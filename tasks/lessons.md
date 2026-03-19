# ROSMAR CRM — Lessons Learned

## 2026-03-20 (Session 19)

### NestJS DI 是 module-scoped，新增 service/guard 要同步更新 module
- **錯誤**: `TxBuilderService` 建了 `@Injectable()` class 但沒加進 `BlockchainModule` 的 providers/exports；多個 module 的 controller 用 `@UseGuards(SessionGuard)` 但沒 import `AuthModule`
- **正確做法**: 新增 service 後立即加到所屬 module 的 `providers` + `exports`。任何 controller 用了 guard/interceptor，確認該 guard 的 module 已被 import。
- **要點**: NestJS 遇到第一個 DI 失敗就停止 bootstrap，一次只能看到一個錯誤。系統性掃描比逐個修有效：grep `SessionGuard` 出現的 controller → 回溯 module → 確認 import

### Cache TTL + timestamp 雙重驗證的時間語意要一致
- **錯誤**: `generateChallenge` 存 `Date.now()`（建立時間），`consumeChallenge` 檢查 `Date.now() < storedValue` → 永遠 false，因為驗證時間一定 >= 建立時間
- **正確做法**: 存過期時間 `Date.now() + TTL_MS`，或存建立時間但比對 `Date.now() - storedValue < TTL_MS`
- **要點**: 時間比較的兩端語意要一致（都是 timestamp 或都是 duration）。這類 bug 不會在 unit test 裡直接暴露，因為 Redis TTL 層已經處理了過期清理，只有 TTL 內的合法請求才被錯殺

## 2026-03-11 (Session 17)

### Move 中 assert 順序要跟狀態變更邏輯一致
- **錯誤**: `revoke_badge()` 先檢查 dedup entry 存在，再檢查 revoked。但 revoke 會移除 dedup entry，導致 double-revoke 時命中 `EBadgeNotFound` 而非語意正確的 `EAlreadyRevoked`
- **正確做法**: 會被操作刪除的 guard 放後面，permanent marker（revoked table）的 guard 放前面。Assertion 順序要考慮「前一次操作改了什麼狀態」
- **要點**: 寫 expected_failure 測試時，先想清楚第二次呼叫時各 assert 會命中哪一個

### Move test 不能直接存取外部 module 的 struct field
- **錯誤**: 測試裡直接用 `registry.minted` 和 `sui::table::borrow()` 存取 QuestRegistry 內部欄位 → `restricted visibility` 編譯錯誤
- **正確做法**: 在 source module 加 `#[test_only]` helper（如 `test_get_badge_id()`），封裝內部存取
- **要點**: Move 2024 Edition 的 struct field 只對定義 module 可見。跨 module 測試一律用 test_only helper

## 2026-03-07 (Session 16)

### 平行 worktree agents 的 API surface 衝突
- **錯誤**: Wave 1 的 NotificationCenter 用 combined hook (`{ notifications, unreadCount, markRead }`)，Wave 2 改了 VaultItemCard props（`secret` → `item`），merge 後 15 個 TS errors
- **正確做法**: Dispatch agent prompt 裡要明確寫「共用元件的 props interface」和「hook 的 export signature」，讓兩個 agent 用一致的 API
- **要點**: Schema 衝突好解（additive），API surface 衝突才是 parallel branches 的真正痛點。Post-merge 一定要跑 `tsc --noEmit`

### Merge 衝突解法：ours/theirs 混合策略
- **做法**: 對「完整重寫」的檔案用 `git checkout --theirs`（如 vault.service.ts）；對「需要合併」的檔案手動 merge（如 app.module.ts、schema.prisma）；對「main 更完整」的用 `git checkout --ours`（如 notification.service.ts）
- **要點**: 不要全部用同一策略。先判斷每個檔案的衝突性質再決定

## 2026-03-07 (Session 15)

### Worktree `pnpm add` 不會帶 node_modules 回 main
- **錯誤**: P2-1 agent 在 worktree 裡 `pnpm add @nestjs/event-emitter`，merge 後 lock file 有但 main 的 `node_modules` 沒有 → BFF build 失敗 `TS2307: Cannot find module`
- **正確做法**: Worktree merge 後一律跑 `pnpm install`（或手動 `pnpm add` 缺的 dep）。Lock file merge ≠ 實際安裝。
- **要點**: Worktree 隔離的是 working tree，不是 node_modules。Merge 完要重裝 deps。

### Agent 回報結果要自己驗證
- **錯誤**: P2-6 agent 回報「`use-sponsored-tx.ts` 有 pre-existing TS errors」和「frontend test runner 沒配」，兩者都是假的
- **正確做法**: Agent 完成後，自己跑 `tsc --noEmit` 和 `pnpm test:run` 驗證。Agent 在 worktree 環境可能有不同的 deps/config 導致誤判。
- **要點**: Agent output 是參考，不是事實。驗證 before reporting。

### Worktree agent 看不到 main 的 recent commits 導致衝突
- **錯誤**: P2-6 agent 修改了 main 已 delete 的檔案（encrypted-note-editor.tsx），用了 raw SQL 而非 main 的 Prisma pattern
- **正確做法**: Dispatch worktree agent 時，在 prompt 裡明確說明 main 的最新架構決策（例如「vault.service 用 Prisma ORM 不要用 raw SQL」）。或用 non-worktree agent 讓它看到最新 code。
- **要點**: Worktree 從 HEAD 分支，但 agent 不知道 main 上其他 recent changes 的 context。高衝突區域要在 prompt 裡補充。

## 2026-03-06 (Session 14)

### Zustand persist hydration race breaks page.goto() in Playwright
- **錯誤**: `page.goto('/profiles')` → layout useEffect sees `isAuthenticated: false` before Zustand hydrates → redirects to `/login` → hydration completes → ends up on `/`
- **正確做法**: Navigate to `/` first (wait for hydration), then use sidebar links (client-side navigation preserves JS state). Create `navigateTo()` helper.
- **要點**: Zustand `persist` rehydrates async. Any `useEffect` checking store values on mount will see defaults, not persisted values.

### Playwright strict mode violations from accumulated test data
- **錯誤**: `getByText('[E2E] Test Corp')` fails when DB has duplicates from previous runs
- **正確做法**: Always use `.first()` on assertions for test-created data. Or add cleanup between runs.
- **要點**: E2E tests create data but don't clean up. Use `.first()` for resilience.

### Test addresses must be valid hex
- **錯誤**: `0xe2e_profile_01_000...` has underscores — not valid hex → API 500
- **正確做法**: Use all-hex addresses like `0x00000000000000000000000000000000000000000000000000000000e2e00001`
- **要點**: SUI addresses are `0x` + 64 hex chars. Don't use readable but invalid addresses.

### vitest picks up Playwright files
- **錯誤**: `pnpm test:run` picks up `e2e/**/*.spec.ts` and fails (Playwright imports not available in jsdom)
- **正確做法**: Add `exclude: ['e2e/**', 'node_modules/**']` to `vitest.config.ts`
- **要點**: When adding Playwright alongside vitest, always exclude E2E directory from vitest.

## 2026-03-05 (Session 4)

### zkLogin 簽名驗證需要 SUI client
- **錯誤**: `verifyPersonalMessageSignature(message, signature)` 不帶 client → zkLogin 簽名驗證失敗（需要 fetch JWK + epoch）
- **正確做法**: `verifyPersonalMessageSignature(message, signature, { client: suiClient })`，client 需初始化為 `new SuiJsonRpcClient({ url, network })`
- **要點**: zkLogin 簽名不像 Ed25519 可以 offline 驗證，它需要 chain 上的 JWK 資料

### Enoki redirectUrl 必須固定
- **錯誤**: Enoki SDK 預設用 `window.location.href` 當 OAuth `redirect_uri`，不同頁面發起會導致 `redirect_uri_mismatch`
- **正確做法**: `registerEnokiWallets({ providers: { google: { clientId, redirectUrl: `${origin}/login` } } })`
- **要點**: OAuth redirect_uri 必須 exact match，動態 URL 會出事。Google Console 的 redirect URIs 也要加對應 URL

### Logout 需要三層清理
- **錯誤**: 只清 BFF cookie + Zustand store，但 dapp-kit wallet 還是 connected → autoConnect 觸發自動重新登入
- **正確做法**: `disconnectWallet()` + `logout()` + `resetWorkspace()` 三層都要清
- **要點**: dapp-kit `WalletProvider autoConnect` 會從 localStorage 恢復連線，logout 必須斷開 wallet

## 2026-03-05

### ValidationPipe whitelist 會吃掉沒有 decorator 的 DTO 屬性
- **錯誤**: DTO class 只有 TypeScript type annotations，沒有 class-validator decorators，導致 `ValidationPipe({ whitelist: true })` 把所有屬性 strip 掉
- **正確做法**: DTO class 的每個屬性都需要至少一個 class-validator decorator（`@IsString()`, `@IsOptional()`, `@Allow()` etc.），否則 whitelist 會移除
- **要點**: 新增 NestJS DTO 時一定要加 class-validator decorators，特別是 `any` 類型用 `@Allow()`

### SUI_DRY_RUN 只 skip execution 不 skip TX build
- **錯誤**: `SUI_DRY_RUN=true` 時 `executeTransaction` 回 mock，但 `buildCreateSegmentTx` 仍然呼叫 `tx.object(configId)`，`configId` 為 undefined → crash
- **正確做法**: service 層加 `execChainTx()` helper，dry-run 時完全跳過 TX build，直接回 mock result
- **要點**: dry-run 的 bypass 要在 build TX **之前**，不能只在 execute 階段

### 本地 dev 程序 port 衝突 Docker
- **錯誤**: 本地 `pnpm dev` 的 BFF 跑在 port 3001，Docker container 也 map 到 3001，curl 打到本地舊版程式碼
- **正確做法**: 測試 Docker 前先確認 `lsof -i :PORT`，kill 掉衝突的本地程序
- **要點**: 「route 有註冊但 curl 404」→ 先查是不是 port 被其他程序佔了

### Docker standalone build 不支援 volume mount src
- **錯誤**: 試圖用 `volumes: ./packages/frontend/src:/app/packages/frontend/src` 讓本地改檔即時同步
- **正確做法**: Next.js `output: 'standalone'` 的 runtime image 只有編譯後的 `server.js`，沒有 `src`。改檔必須 `docker compose up -d --build frontend`。
- **要點**: 確認 Dockerfile 是 dev 還是 production build，再決定開發方式。Production standalone → rebuild；Dev → 本地 `pnpm dev`。

### 手動 timezone → country mapping 不可維護
- **錯誤**: 手寫 ~80 個城市的 country name mapping，結果大量城市沒有國名
- **正確做法**: 用 IANA zone1970.tab 的 timezone → ISO country code 完整 mapping（350+），再用 `Intl.DisplayNames({ type: "region" })` 自動轉國名
- **要點**: 涉及 i18n/locale 資料的，優先用瀏覽器內建 `Intl` API，不要手動維護字典。

### ScrollArea overflow:hidden 會 clip hover 效果
- **錯誤**: Card base 有 `hover:-translate-y-0.5`，在 ScrollArea 內導致 border 上方被裁切
- **正確做法**: 可滾動容器內的卡片用 `!translate-y-0` 覆蓋，或改用 border/shadow 變化代替 translate。內容列表加 `p-1` padding 容納 border/shadow。
- **要點**: `overflow: hidden/auto` 容器裡避免用 transform 把元素推出邊界。

## 2026-03-01

### scrollIntoView 在 overflow container 裡的行為
- **錯誤**: 用 `scrollIntoView({ block: "start" })` 試圖固定 tab 位置，結果把 tabs div 滾到 `<main>` 頂端，header 被推出畫面
- **正確做法**: 用 **sticky positioning** (`sticky top-0`) 讓 tab bar 釘在 scroll container 頂部。不需要 JS scroll 操作。
- **要點**: 先確認 scroll container 是誰（`<main overflow-auto>`），再決定 scroll 策略。`scrollIntoView` 在 nested scroll container 裡很容易行為不如預期。

### FK constraint 要看 schema 再給 UI
- **錯誤**: Deal 的 Profile ID 欄位讓用戶自由輸入 `0x...` Sui address，但 DB 外鍵指向 profiles.id (UUID)
- **正確做法**: 有外鍵的欄位一律用 dropdown/select 從 DB 資料選，不要讓用戶手動輸入 ID。
- **要點**: 新增任何 create form 前，先看 Prisma schema 的 relation，確認哪些欄位有 FK constraint。

### Stage 定義要單一來源
- **錯誤**: Kanban board 和 Create dialog 各自 hardcode stage 列表，名稱和數量都不同步
- **正確做法**: 建立 shared constant (`lib/constants.ts` 的 `DEAL_STAGES`)，所有地方引用同一份。
- **要點**: 任何 enum-like 值（stage, status, role）都應該定義在一個地方，不要在多個元件裡重複定義。
