# Decentralized CRM 完整功能規格書 (Functional Specification)

**版本**: v1.0
**日期**: 2026-02-15
**狀態**: Draft
**目標**: 打造一款結合 Web2 頂級體驗 (Salesforce/HubSpot) 與 Web3 原生優勢 (Sui/Walrus/Seal) 的企業級 CRM。

---

## 1. 產品概述 (Product Overview)

本產品為一款 **"Web3 Native Intelligent CRM"**。不僅管理客戶關係，更直接管理**鏈上價值交換**。
核心差異化在於將「錢包地址」視為核心身分，將「鏈上行為」視為即時訊號，並透過「智能合約」自動化執行商業流程。

---

## 2. 核心模組規格 (Core Modules)

### 2.1 Unified Web3 Identity (統一身分識別模組)
*解決 Web2 CRM 無法識別匿名錢包的問題。*

*   **多鏈錢包聚合 (Multi-chain Wallet Aggregation)**
    *   支援單一 Profile 綁定無限多個錢包地址 (Sui, EVM, Solana)。
    *   自動偵測並合併同一個 HD Wallet 衍生出的地址。
*   **DID 與域名整合**
    *   原生整合 SuiNS (.sui), ENS (.eth), SNS (.sol)。
    *   自動解析並顯示 Avatar 與主要域名。
*   **Web2 + Web3 身分關聯**
    *   透過 ZkLogin (Google/Apple) 登入，自動生成並綁定 Sui 地址。
    *   支援 Social Linking (Telegram, Discord, X) 綁定至同一 Profile。
*   **360度資產視圖**
    *   即時顯示跨鏈總資產 (Net Worth)。
    *   NFT 持有清單 (Gallery Mode) 與特徵 (Metadata) 分析。

### 2.2 On-chain Customer Data Platform (鏈上客戶數據平台 - CDP)
*對標 Salesforce Data Cloud，但針對鏈上數據。*

*   **Real-time Event Indexer (即時事件索引)**
    *   **Mint 監聽器**: 當用戶 Mint 特定 Collection 時，秒級寫入 CRM。
    *   **DeFi 行為追蹤**: 監測 Swap, Stake, Add Liquidity 行為。
    *   **Governance 追蹤**: 監測 DAO 提案投票紀錄。
*   **Web3 Engagement Score (活躍度評分)**
    *   除了傳統的 Email 開信率，新增「鏈上活躍分」。
    *   權重可自定義：例如 `Hold Time * 0.5 + Vote Count * 2 + Tx Value * 0.1`。
    *   **Whale Alert**: 當高淨值用戶 ($1M+) 進入系統或進行操作時，自動通知。

### 2.3 Intelligent Web3 Agents (AI 智能代理)
*對標 Salesforce Agentforce / HubSpot Breeze，但具備執行交易能力。*

*   **AI Analyst Agent (分析代理)**
    *   自然語言查詢：「幫我找出持有藍籌 NFT 且超過 3 個月沒互動的 VIP 用戶」。
    *   自動生成數據報表與 Segmentation 建議。
*   **On-chain Action Agent (行動代理)**
    *   **Auto-Airdrop**: 「對所有昨晚參與投票的用戶，空投一個紀念 NFT」。
    *   **Gas Station**: 「自動為餘額不足 0.1 SUI 的新用戶贊助 Gas」。
    *   **Yield Optimizer**: 監控 Treasury 資金，建議最佳 DeFi 收益策略 (需人工簽署)。
*   **Content Agent (內容代理)**
    *   根據用戶的鏈上標籤 (e.g., "DeFi Degen", "NFT Collector") 自動生成客製化的行銷文案。

### 2.4 Dynamic Segmentation & Marketing Automation
*對標 HubSpot Marketing Hub。*

*   **Smart Segments (智慧分眾)**
    *   **動態規則引擎**: 設定條件 (e.g., "持有 CryptoPunks" AND "Discord Level > 5")，名單自動更新。
    *   **Lookalike Audiences**: 分析現有高價值客戶的鏈上行為特徵，找出潛在類似錢包地址。
*   **Web3 Journey Builder (旅程構建器)**
    *   可視化拖拉流程圖 (Drag-and-Drop Workflow)。
    *   **Triggers**: Wallet Connect, NFT Mint, Token Transfer, Time Elapsed.
    *   **Actions**: Send Telegram Message, Grant Discord Role, Airdrop Token, Check-in POAP.
*   **Q3 (Quest-to-Qualify)**
    *   內建任務系統：要求用戶完成鏈上任務 (Swap/Stake) 以解鎖 CRM 內的特定權益。

### 2.5 Sales Pipeline & Deal Rooms
*對標 Pipedrive / Salesforce Sales Cloud。*

*   **Web3 Deal Structure**
    *   支援 Token Vesting 條款設定。
    *   支援 SAFT (Simple Agreement for Future Tokens) 模板管理。
*   **On-chain Deal Room (鏈上交易室)**
    *   為每個 Deal 建立專屬的 Access-gated Page。
    *   整合 Seal + Walrus：只有買賣雙方錢包能解密查看合約草稿與盡職調查 (DD) 文件。
    *   **Escrow Integration**: 直連智能合約託管資金，Deal Won = 資金解鎖。

### 2.6 Privacy & Security Vault (隱私保險箱)
*基於 Seal + Walrus + Sui 權限控制。*

*   **Decentralized Encrypted Storage**
    *   所有敏感資料 (個人筆記、合約、KYC 資料) 經 Seal 加密後存入 Walrus。
    *   沒有任何中心化伺服器持有解密金鑰 (Non-custodial Data)。
*   **Granular Access Control (細緻權限)**
    *   基於角色的存取控制 (RBAC) 寫在 Sui 合約上。
    *   可設定「時間鎖」：文件在特定時間後自動銷毀或解鎖。

---

## 3. 技術架構與規格 (Technical Specs)

### 3.1 區塊鏈層 (Sui Network)
*   **Object-based Data Model**: 利用 Sui 物件模型直接對應 CRM Entity (Profile, Org, Deal)。大數據量的靜態屬性存鏈下，所有權與狀態屬性存鏈上。
*   **ZkLogin Integration**: 原生支援 Web2 帳號無縫登入。
*   **SuiNS Integration**: 用戶名解析標準。

### 3.2 存儲層 (Walrus Protocol)
*   應對大檔案與歷史數據存儲，確保存儲成本低廉且去中心化。
*   Blob ID 記錄在 Sui Object 中作為索引。

### 3.3 隱私層 (Seal)
*   實作 Client-side Encryption (端對端加密)。
*   基於 TEE (Trusted Execution Environment) 的權限驗證服務。

### 3.4 應用層 (Frontend & API)
*   **Framework**: Next.js + React.
*   **UI Library**: Tailwind CSS + Shadcn UI (追求極致現代化體驗)。
*   **Indexer**: 自建 Indexer (Rust/Sui Indexer framework) 針對特定合約進行高效索引。

---

## 4. 系統需求與非功能性需求 (NFR)

*   **High Performance**: Profile 頁面載入需 < 1秒 (即時聚合鏈上數據需做緩存)。
*   **Security**: 通過慢霧 (SlowMist) 或 CertiK 智能合約審計。
*   **Compliance**: 支援 GDPR "Right to be Forgotten" (透過銷毀解密金鑰實現)。

---

## 5. 未來擴充性 (Roadmap Items)

*   **Plugin Marketplace**: 開放第三方開發者上架 "Actions" (e.g., 整合 Lens Protocol, Snapshot)。
*   **Mobile App**: 專屬 iOS/Android App，整合手機生物辨識簽章。
*   **Data DAO**: 允許用戶將自己的 CRM 數據變現，授權給品牌使用並獲得分潤。
