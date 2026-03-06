# ROSMAR Decentralized CRM — Spec v2

**版本**: 2.0
**日期**: 2026-03-05
**定位**: Web3 Native Privacy-First Agentic CRM
**技術棧**: Sui + Seal + Walrus + NestJS + Next.js + Prisma + TimescaleDB

> **一句話產品定位**：專為 Web3 品牌與協議打造的 privacy-first, agentic CRM —— 一個地方，看懂 on-chain 用戶、設計自動化價值交換流程，並用去中心化 vault 保護所有敏感資料。

---

## 目錄

1. [產品願景與戰略定位](#1-產品願景與戰略定位)
2. [身分與登入 (Identity & Access)](#2-身分與登入)
3. [客戶與帳戶管理 (Contacts, Accounts, Web3 Profiles)](#3-客戶與帳戶管理)
4. [鏈上資料與活動 (On-chain Data & Activity)](#4-鏈上資料與活動)
5. [分析與儀表板 (Analytics & Dashboards)](#5-分析與儀表板)
6. [銷售與管道管理 (Sales & Pipeline)](#6-銷售與管道管理)
7. [行銷與自動化 (Marketing & Automation)](#7-行銷與自動化)
8. [AI Agents](#8-ai-agents)
9. [訊息與通知 (Messaging & Notifications)](#9-訊息與通知)
10. [客服與支援 (Service & Support)](#10-客服與支援)
11. [隱私金庫 (Privacy Vault)](#11-隱私金庫)
12. [筆記、文件與附件 (Notes, Docs, Files)](#12-筆記文件與附件)
13. [整合與可組合性 (Integrations & Composability)](#13-整合與可組合性)
14. [系統層級要求 (Product-grade Requirements)](#14-系統層級要求) — 含技術架構 §14.4
15. [UX / No-code 強化](#15-ux--no-code-強化)
16. [競品差異化分析](#16-競品差異化分析)
17. [產品路徑與里程碑](#17-產品路徑與里程碑)

---

## 1. 產品願景與戰略定位

### 1.1 為什麼 Web2 CRM 在 Web3 失效？

| 痛點 | 說明 |
|------|------|
| **身分識別斷裂** | Web2 CRM 依賴 Email/電話，無法識別 `0x...` 錢包地址背後的高價值用戶（Whales） |
| **數據孤島** | 鏈上數據（資產、交易記錄）是公開且即時的，但 Web2 CRM 無法原生讀取 |
| **缺乏價值傳遞** | Web2 CRM 只能發送「訊息」，無法直接發送「價值」（Token, NFT rewards） |

### 1.2 核心差異化（vs Holder / Kazm / Blaze / Blocksee / Formo）

| 維度 | ROSMAR 優勢 |
|------|------------|
| **去中心化隱私** | Seal + Walrus + Sui ACL 端到端加密，data sovereignty；競品皆為 centralized SaaS |
| **On-chain Action Agents** | AI + 智能合約自動執行空投/補 gas/操作 treasury，超越一般 automation rules |
| **Sales / Deal Room** | SAFT 模板、vesting 條款、on-chain escrow — 面向 B2B token deal 的藍海 |
| **全棧 CRM** | 不只是 analytics 或 loyalty 工具，涵蓋 Sales + Marketing + Service + Vault |

### 1.3 Web2 → Web3 功能轉譯

| Web2 核心功能 | Web3 轉化功能 | 戰略價值 |
|:---|:---|:---|
| Unified Customer Profile (Email + Phone) | **Unified Web3 Profile** (Wallet + DID + Social + On-chain History) | 解決身分破碎問題 |
| Salesforce Data Cloud (即時串接 IoT/Web) | **Sui Indexer & Activity Engine** (即時串接鏈上事件) | 鏈上行為成為即時行銷信號 |
| Agentforce / AI Agents (AI 自動回信) | **On-chain Action Agents** (AI 自動空投/白名單/Gas 贊助) | 從自動化溝通→自動化價值交換 |
| Marketing Automation Flows | **Smart Contract Automation** (持有 NFT→解鎖 Discord→領 Token) | 智能合約確保信任與執行力 |
| Private Attachments (AWS S3) | **Decentralized Vault** (Seal + Walrus) | 消除單點故障與隱私疑慮 |

---

## 2. 身分與登入

### 2.1 使用者與角色管理

- 支援團隊成員帳號（Owner / Admin / Sales / Marketing / Support / Analyst 等自訂角色）
- 每個角色對「客戶資料、筆記、檔案、訊息、整合」都有細緻權限（讀、寫、分享、管理）
- 角色與權限規則部署在 Sui 上，可稽核、可升級，所有變更產生鏈上 event

### 2.2 登入與驗證

- 支援 ZkLogin / Passkey 無密碼登入，綁定 Sui address
- 支援團隊成員多裝置登入、風險裝置提醒
- 客戶可使用錢包 / ZkLogin 登入 self-service portal（查看個人資料授權、訂閱偏好等）

### 2.3 資料存取控制

- 對每一個 profile / note / file / segment / campaign 設定 access policy
- Access policy 由 Seal 合約強制執行：只有符合角色/條件的使用者可以解密

---

## 3. 客戶與帳戶管理

### 3.1 Unified Web3 Profile

單一 Profile 下聚合：
- **多鏈錢包聚合**：Sui 為主，支援 EVM / Solana 地址綁定；自動偵測並合併同一 HD Wallet 衍生的地址
- **DID 與域名整合**：原生整合 SuiNS (.sui)、ENS (.eth)、SNS (.sol)；自動解析並顯示 Avatar 與主要域名
- **Web2 + Web3 身分關聯**：透過 ZkLogin (Google/Apple) 登入自動綁定 Sui 地址；支援 Social Linking (Telegram, Discord, X)
- Email、電話（可選）、社群帳號（Telegram / Discord / X）
- 自訂欄位：文字、數字、標籤、日期、選單等，支援不同 workspace 自訂
- **360° 資產視圖**：即時顯示跨鏈總資產 (Net Worth)；NFT 持有清單 (Gallery Mode) 與 Metadata 特徵分析

**v2 強化 — Profile UI & Timeline**：

- Profile 頁必備區塊：
  - **Header**：Avatar、主要域名（SuiNS/ENS）、主鏈地址、標籤（NFT Collector / DeFi Power User / DAO Voter 等，從 engagement score 自動標）
  - **中央 Timeline**：支援事件型別與過濾器：
    - On-chain：Mint / Swap / Stake / Vote / Transfer
    - Off-chain：Telegram / Discord 加入、role 變更、campaign 互動（打開訊息、完成 quest）
    - System：被加入 segment、收到 airdrop、進入/離開某個 deal
  - **右側 Summary**：Engagement Score、所屬 segments、近期 campaigns、打開率
- **API**：
  - `GET /profiles/{id}` — 回傳 profile 基本資料 + 近期 N 筆 timeline event
  - `GET /profiles/{id}/timeline?type=onchain|social|campaign&limit=N`

**v2 強化 — Segment 快捷操作**：

- 在 Profile 頁可直接：「加入/移除 segment」、「加入 campaign」、「打開 Deal Room」
- API：`POST /segments/{id}/profiles:add`、`POST /campaigns/{id}/enroll`

### 3.2 組織 / DAO / Project 帳戶

- 支援「組織」實體：公司 / DAO / 協議 / NFT 專案
- Contacts 可被指派為該組織的角色（Founder / Core Contributor / Investor 等）

### 3.3 客戶片段與等級

- 依照：持有 token 數量、持有時間、互動頻率、貢獻分數自動分級（VIP / Core / Active / Dormant）
- 支援靜態 segment（手動建立清單）與動態 segment（條件自動更新）
- **v2 新增**：預設 segment 模板（如「High-value Trader」、「Dormant Whales」、「DAO Active Voter」）

---

## 4. 鏈上資料與活動

### 4.1 鏈上行為聚合

- 自動從鏈上抓取：NFT mint / transfer、FT 轉帳、staking、governance vote、合約互動
- 把這些 event 綁到對應的 profile timeline（按時間排序）

### 4.2 Web3 活躍度分數

- 自動計算 engagement score（可自訂權重）：交易頻率、持有金額、投票參與、參與活動次數
  - 公式範例：`Hold Time * 0.5 + Vote Count * 2 + Tx Value * 0.1`
- 在 profile 上顯示分數，可用於 segmentation 與 campaign 條件
- **Whale Alert**：當高淨值用戶（$1M+）進入系統或進行大額操作時，自動通知相關團隊成員
- **v2 新增**：預設幾套算式供選（DeFi 模式 / NFT 模式 / DAO 模式），降低設定門檻

### 4.3 多鏈支援（可選進階）

- 抽象錢包概念：一個 profile 可有不同鏈的地址
- 共用 engagement score，並可區分 per-chain 活動

---

## 5. 分析與儀表板

### 5.1 即時儀表板

概覽卡片：
- 活躍 wallet 數、持有者分布、top segments
- 銷售 pipeline 總額、預估收入
- 工單量與解決時間、滿意度

### 5.2 v2 新增 — Dashboard 模板（至少實作三套）

**1. NFT / Membership Dashboard**
- 指標：新持有者數（日/週）、總持有者、whale 數、二級交易數
- Funnel：visitor → wallet connect → mint → repeat mint → secondary trade
- 首次 mint → 二次互動的轉換率
- API：`GET /dashboards/nft-basic?collection_id=...`

**2. DeFi Protocol Dashboard**
- 指標：新存款錢包、活躍錢包、TVL 變化
- 7/30 日留存（仍有頭寸或曾互動）
- 分群：Farmer vs 長期 LP vs 治理活躍者
- API：`GET /dashboards/defi-basic?protocol_id=...`

**3. DAO / Governance Dashboard**
- 指標：提案數、投票 participation rate、活躍投票者 vs 總 holder
- 依投票參與度分級的 user bucket
- API：`GET /dashboards/dao-basic?dao_id=...`

### 5.3 v2 新增 — Cohort / Retention API

- 按「首次 mint / 首次 deposit / 首次投票」分 cohort，計算 7/30/90 天留存
- API：`GET /analytics/cohorts?event_type=mint|deposit|vote&interval=week`

### 5.4 鏈上 + CRM 混合分析

- 報表示例：
  - 「持有 OG NFT 且過去 30 天在 Discord 有發言」的留存率
  - Campaign 對應的 mint / vote 數與轉換率
- 活動歸因：把 campaign id / quest id 當作一級維度，計算 LTV / 留存 / 行為差異
- 將聚合指標（匿名化與加總）輸出給合作的 analytics dApp

### 5.5 匯出 / API

- 提供加密資料的 API（需符合 access policy 才能解密）
- 匯出報表 CSV（只包含已授權維度），方便接進傳統 BI 工具

---

## 6. 銷售與管道管理

### 6.1 潛在客戶與商機（Leads & Opportunities）

- 建立 Leads（尚未確認身分或錢包）、Contacts、Opportunities
- 支援從網站表單 / 活動報名 / 錢包簽名註冊自動產生 Lead
- 可以把「一次 NFT 鑄造、代幣銷售、顧問案」視為一個 Opportunity

### 6.2 銷售管道管理（Pipeline）

- 自訂 pipeline 階段：e.g. New → Qualified → Proposal → Won / Lost
- 看板視圖管理 deal，拖拉改變階段
- 每個 deal 記錄：預估金額、預估成交日期、關聯的 profile / 組織

**v2 強化 — Deal Pipeline 視圖**：
- Kanban 風格欄位：New / Qualified / Proposal / **On-chain Escrow** / Won / Lost
- 每張 card 顯示：對方 org、deal size（可顯示 token + USD）、預計關單日

### 6.3 報價與合約（Quote / Agreement）

- 建立簡易報價單（可選：計價用 USDT / token / 法幣顯示）
- 可連結到鏈上合約（例如 SAFT / 顧問協議對應的一組合約地址）

### 6.4 v2 強化 — Deal Room

每個 Deal Room 包含：
- **成員名單**：雙方地址與角色
- **Files tab**：透過 Vault 上傳合約、財報等（標示「encrypted via Seal」）
- **Messages / Notes**：針對 deal 的討論（可選擇是否加密）
- **Timeline**：誰何時上傳檔案、誰開啟文件、誰留言
- **Escrow 狀態**：顯示合約地址、已存入金額、解鎖條件

API：
- `POST /deals` — 建立 deal & room
- `POST /deals/{id}/invite` — 邀請對方地址加入
- `POST /deals/{id}/vault_items` — 上傳文件

### 6.5 v2 新增 — On-chain Escrow 整合

Move 合約介面：
- `create_escrow(deal_id, payer, payee, amount, token)`
- `release_escrow(deal_id)`
- `refund_escrow(deal_id)`

### 6.6 銷售自動化

- 新 lead 進來 → 指派 BD → 建立跟進任務
- 某階段停留超過 N 天 → 發提醒給 owner

---

## 7. 行銷與自動化

### 7.1 分眾與名單管理

多維度 segmentation（鏈上 + 鏈外）：
- 持有某 collection / token
- 最後互動時間
- 加入 Discord 角色
- 銷售管道階段、地區、語言
- **Lookalike Audiences**：分析現有高價值客戶的鏈上行為特徵，自動找出潛在類似錢包地址
- **Q3 (Quest-to-Qualify)**：內建任務系統，要求用戶完成鏈上任務（Swap / Stake / Vote）以解鎖 CRM 內的特定權益或進入特定 segment

### 7.2 Campaign 管理

- 建立 campaign：名稱、目標、開始/結束日期、目標 segment
- 設定 campaign 目標 KPI：mint 數量、活動報名數、投票參與率等

### 7.3 v2 強化 — Journey Builder & Flow Engine

**Trigger 類型**：
- `wallet_connected`、`nft_minted(collection_id)`、`token_transferred(token)`
- `governance_voted(dao_id)`、`segment_entered(id)`、`segment_exited(id)`
- `time_elapsed(X days)`

**Action 類型**：
- `send_telegram_message(template_id)`
- `send_discord_dm(template_id)`
- `grant_discord_role(role_id)`
- `airdrop_token(token_contract, amount)`
- `airdrop_nft(collection_id, token_id | random)`
- `issue_poap(event_id)`

**Flow 定義格式**（供 API / AI 使用）：
```json
{
  "name": "NFT Welcome Playbook",
  "triggers": [{"type": "nft_minted", "params": {"collection_id": "0x..."}}],
  "nodes": [
    {
      "id": "check_engagement",
      "type": "condition",
      "expression": "engagement_score > 80"
    },
    {
      "id": "action_high",
      "type": "action",
      "action_type": "airdrop_nft",
      "params": {},
      "next": null
    }
  ]
}
```

### 7.4 v2 新增 — 預設 Playbook 模板（至少內建 4 個）

**1. NFT Welcome / Re-engagement**
- Trigger：mint 某 collection
- Actions：立即發 Discord DM 歡迎 → 24h 未加入 Discord 自動提醒 → 7 天無二級活動發 quest
- KPI：7 日活躍率、二級市場交易率

**2. DeFi New User Activation**
- Trigger：第一次存款
- Actions：TG/Discord 提醒 → 發送 governance 提案摘要 → small incentive NFT
- KPI：7/30 日留存

**3. DAO Voting Reminder / Reward**
- Trigger：新提案建立
- Actions：推播提醒 → 投票完成後自動發 POAP
- KPI：投票 participation rate

**4. Membership Tier Upgrade（Loyalty 風格）**
- Trigger：mint 會員 NFT / 完成特定 quest
- Actions：自動同步 Discord role → 開啟 members-only 頻道 → 定期 tier 升級提醒
- KPI：tier 晉升率

每個模板需定義：觸發條件、主要 action list、預設 KPI、對應 UI（template gallery 點擊後自動產生可編輯 flow JSON）

### 7.5 v2 新增 — Flow 執行監控

- 每個 workflow 顯示：進入人數、各節點流量、轉換率
- API：`GET /workflows/{id}/stats`

---

## 8. AI Agents

### 8.1 AI Analyst Agent

- 介面：`POST /agents/analyst/query`
  - Input：自然語言 + 可選約束（time range, project id）
  - Output：結構化 query（對 indexer 的 SQL / DSL）、預計回傳欄位與圖表類型
- 要求：產生的 query 必須可被 analytics 服務執行

### 8.2 On-chain Action Agent

- 介面：`POST /agents/action/plan`
  - Input：如「對所有昨晚參與投票的用戶空投紀念 NFT」
  - Output：目標 segment 定義、估算 gas / 成本、建議交易批次與安全檢查
- 由人類 review 後，呼叫 `POST /agents/action/execute` 觸發實際交易

### 8.3 Content Agent

- `POST /agents/content/generate`
  - Input：segment 描述、channel（TG/Discord/Email）、tone
  - Output：文案 + 變數佔位，直接存入 `/templates/message`

---

## 9. 訊息與通知

### 9.1 加密訊息

- 對某個 profile 或 segment 發送加密訊息（公告、邀請、私訊）
- 收件方透過錢包 / ZkLogin 解密，內容受 Seal policy 限制

### 9.2 v2 強化 — Telegram Integration

- Bot 收訊息：新使用者 `/start` → 建立/綁定 profile
- 支援廣播：對 segment 或 workflow 節點發送群發訊息
- 支援個人 DM：從 Profile 頁直接發訊息
- API：
  - Webhook：`POST /integrations/telegram/webhook`
  - 動作：`POST /integrations/telegram/send`

### 9.3 v2 強化 — Discord Integration

- 根據 segment 自動 assign / revoke role
- 支援 channel broadcast
- Log：將 join / leave / message count 作為 social activity 寫進 profile
- API：
  - `POST /integrations/discord/webhook`
  - `POST /integrations/discord/roles/grant`

### 9.4 v2 新增 — Template & Content 管理

- Content Agent 生成的文案落地為可重用 template
- `POST /templates/message`（存文案 + 變數佔位）
- Journey Builder 裡選用 template id

### 9.5 通知中心

- 系統內通知（任務、工單、deal 變更）
- Email / Telegram DM 通知（可選），針對重要事件

---

## 10. 客服與支援

### 10.1 工單 / Case 管理

- 把來自 email / Telegram bot / Discord bot 的問題轉成工單
- 工單掛在某個 profile / 組織底下，記錄處理歷程

### 10.2 SLA 與狀態追蹤

- 狀態：Open / In Progress / Waiting / Resolved / Closed
- SLA 設定：不同優先級的回應/解決時間門檻，延遲時發出提醒或升級

### 10.3 知識庫（可選）

- 支援連結 external knowledge base，或在系統內維護簡易 FAQ
- 與工單關聯：解決時可 linkage 到某個 KB 文章

---

## 11. 隱私金庫

### 11.1 v2 強化 — Vault 抽象介面（Productization）

把 Seal + Walrus 使用抽象成獨立 Vault 模組，可給內部其他模組與外部 dApp 共用。

- `POST /vault/items`
  - Input：`{ "type": "note|file|kyc|deal_doc", "owner_profile_id": "...", "acl_policy_id": "...", "payload": <raw bytes or json> }`
  - 行為：前端或後端透過 Seal 加密，blob 存 Walrus，回傳 `vault_item_id`
- `GET /vault/items/{id}`
  - 先驗證使用者 wallet / role 是否符合 `acl_policy`；通過才回傳 encrypted blob 給 client 解密

### 11.2 ACL / Policy 合約要求

- 每個 `vault_item_id` 在 Sui 上需有對應 object：
  - 欄位：擁有者、可讀角色、可寫角色、過期時間、Walrus blob id
- 變更 ACL 時需 emit event，方便 audit
- 一鍵 revoke：銷毀金鑰後再也無法讀取
- GDPR「刪除權」透過銷毀金鑰實現

### 11.3 Vault Audit Log

- 每次 `GET /vault/items/{id}` 需寫入 `vault_access_log`：
  - `user_id / wallet`、`vault_item_id`、`timestamp`、`action_type=view`
- API：`GET /vault/items/{id}/audit?from=...&to=...`

### 11.4 外部 API 開放

- 把 Vault 開 API，讓別的 Web3 工具也能用
- 對外定位：「Web3 CRM privacy & compliance infra」

---

## 12. 筆記、文件與附件

### 12.1 安全筆記

- 針對 profile / deal / organization 建立私人/共用筆記
- 所有筆記透過 Seal 加密儲存在 Walrus，權限定義在 Sui

### 12.2 加密文件與媒體

- 上傳檔案（合約 PDF、簡報、KOL 合作文件、活動名單等）
- Walrus 儲存加密檔案，僅有權限者可透過客戶端解密

### 12.3 版本與歷程

- 針對文件保持版本號與更動紀錄
- 所有新增/修改/權限變更在鏈上留下 event（audit log）

---

## 13. 整合與可組合性

### 13.1 外部 dApp / 工具整合

- **Event Management dApps**：自動把 segment 同步成「活動邀請名單」，活動簽到結果回寫 profile
- **Airdrop / Reward 工具**：以 segment + on-chain 條件作為投放條件
- **Partner dApps**：經過 opt-in 的 profile 資料可被夥伴 dApp 讀取（遵守同 access policy）

### 13.2 Web2 工具整合（可選）

- Email service（SendGrid / Mailgun）作為 fallback 渠道
- Slack / Lark 通知：重大事件推送給內部團隊

---

## 14. 系統層級要求

### 14.1 多 workspace / multi-tenant

- 一個使用者可以加入多個 workspace
- 各 workspace 之間資料完全隔離，權限由鏈上 policy 管理
- 所有新增分析 API 需支援 `project_id` / `workspace_id` 作隔離

### 14.2 審計與合規

- 所有 CRUD 操作對應的鏈上 event，可回溯誰在什麼時間做了什麼事
- 提供「審計模式」檢視指定時段的操作紀錄

### 14.3 UX / 可用性

- Web app 為主，桌機優化
- 搜尋與快搜（Ctrl+K）：快速找到人、組織、segment、campaign
- 支援英文介面，日後可擴展多語系

### 14.4 技術架構

- **區塊鏈層 (Sui Network)**：
  - 利用 Sui Object Model 直接對應 CRM Entity (Profile, Org, Deal)
  - 大數據量的靜態屬性存鏈下，所有權與狀態屬性存鏈上
  - 原生整合 ZkLogin、SuiNS
- **存儲層 (Walrus Protocol)**：
  - 大檔案與歷史數據去中心化存儲，Blob ID 記錄在 Sui Object 中作為索引
- **隱私層 (Seal)**：
  - Client-side Encryption (端對端加密)
  - 基於 TEE (Trusted Execution Environment) 的權限驗證服務
- **應用層**：
  - Frontend：Next.js + React + Tailwind CSS + Shadcn UI
  - Backend：NestJS + Prisma 7 + TimescaleDB + Redis
  - Indexer：自建 Indexer (Rust/Sui Indexer framework) 針對特定合約高效索引

### 14.5 非功能性要求

- Flow engine 與 Agents 執行需透過 job queue，確保在高負載下不會阻塞主 API
- Messaging 整合需提供 sandbox 模式（只 log 不實際發送），方便測試
- 所有加密與 Vault 操作需有統一 error code，方便前端處理「無權限/金鑰失效」等狀況
- 分析 API 回應時間 < 1s
- **安全審計**：智能合約需通過 SlowMist / CertiK 等第三方審計
- **合規**：支援 GDPR "Right to be Forgotten"（透過銷毀 Seal 解密金鑰實現）

---

## 15. UX / No-code 強化

### 15.1 模板 Gallery

三個模板欄目：
- **Dashboards**：NFT / DeFi / DAO
- **Journeys / Playbooks**：預設 4+ 個 playbook
- **Segment Presets**：如「High-value Trader」、「Dormant Whales」

### 15.2 Onboarding Wizard

新 workspace 建立時引導：
1. 連結鏈（選 Sui / 其他）
2. 連接 Telegram / Discord
3. 選一個行業（NFT / DeFi / DAO）
4. 自動建立對應 dashboard + 1 個 playbook

---

## 16. 競品差異化分析

| 產品 | 定位 / 強項 | 相對 ROSMAR 的短板 |
|:---|:---|:---|
| **Holder** | Web3 品牌 CRM + Marketing Automation，no-code automation builder | 偏行銷自動化，無 sales pipeline、deal room、端到端加密、AI agents |
| **Kazm** | Web3 loyalty / membership，白標會員計畫 | 僅 membership lifecycle，缺 CDP、sales pipeline、vault、AI agent |
| **Blaze** | 社群 CRM + analytics，Discord/Twitter 成長分析 | 側重 social graph，少價值交換、deal room、加密存儲 |
| **Blocksee** | On-chain data index + no-code dashboard | 偏 data platform，去中心化/隱私敘事不強，非 sales/marketing workflow |
| **Formo** | User lifecycle analytics，cohort/留存/segmentation | 主要 analytics，無 messaging、自動化流程、deal management |
| **CRMchat / 3RM** | Telegram-first CRM，bulk messaging | 高度依賴 Telegram，on-chain CDP/隱私/AI agents 支援少 |

---

## 17. 產品路徑與里程碑

### Phase 1: The "On-chain Hub" (MVP) ✅ 已完成

- Wallet-first Login (ZkLogin + Passkey)
- Unified Web3 Profile + On-chain Activity Feed
- 基礎 Segmentation（依據 Token 持有量）
- Sales Pipeline + Deal Kanban
- Privacy Vault（Seal + Walrus + Sui ACL）
- 簡單 Dashboard：活躍錢包、持有者分布

### Phase 2: The "Autonomy Engine" (Growth) — 當前階段

核心價值：自動化 Web3 營運流程 + 可用性提升

- [ ] Dashboard 模板（NFT / DeFi / DAO）
- [ ] Cohort / Retention 分析
- [ ] Journey Builder + Playbook 模板
- [ ] Telegram / Discord 深度整合
- [ ] Vault API productization + Audit Log
- [ ] Deal Room 功能細化 + Escrow
- [ ] AI Agents（Analyst / Action / Content）
- [ ] Template Gallery + Onboarding Wizard
- [ ] 預設 Segment Presets + Engagement Score 預設算式

### Phase 3: The "Ecosystem Platform" (Scale)

- 開放 API（供其他 dApp 讀取 CRM 數據）
- 自定義 AI Agent 市場
- 跨鏈支援
- 客服工單系統完善
- Knowledge Base
- **Plugin Marketplace**：開放第三方開發者上架 "Actions"（e.g. 整合 Lens Protocol, Snapshot）
- **Mobile App**：專屬 iOS/Android App，整合手機生物辨識簽章
- **Data DAO**：允許用戶將自己的 CRM 數據變現，授權給品牌使用並獲得分潤

---

## 參考資料

- [Salesforce Agentforce](https://www.salesforce.com) — AI Agent 代理概念
- [HubSpot Breeze](https://www.hubspot.com) — 極致易用與行銷自動化
- [Zoho Canvas](https://www.zoho.com) — No-code UI 設計器
- [Holder](https://www.holder.xyz) — Web3 Marketing Automation
- [Kazm](https://kazm.com) — Web3 Loyalty / Membership
- [Blaze](https://blaze.so) — Web3 Community CRM
- [Blocksee](https://blocksee.io) — Web3 Data Platform + CRM
- [Formo](https://formo.so) — Web3 User Lifecycle Analytics
- [CRMchat](https://crmchat.ai) — Telegram CRM
