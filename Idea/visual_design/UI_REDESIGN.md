# ROSMAR CRM — UI Redesign Spec

> 整合自 `plan.md`、`Idea/plan.md`、`frontend-notes.md`
> Last updated: 2026-03-05

---

## 1. 設計理念 (Design Philosophy)

**關鍵字**: Clean · Expensive · Minimalist
**動態系統**: iOS spring curve `cubic-bezier(0.32, 0.72, 0, 1)` 全局動畫基準
**視覺層次**: background → content area → card（各層 oklch 明度遞進）

### 雙主題策略

| 模式 | 概念 | 特徵 |
|------|------|------|
| **Light** | Glacier + Treasury | 明亮通透毛玻璃 (Glassmorphism)，青色與白金色點綴 |
| **Dark** | Bioluminescent | 深海藍色調，發光青色光束，沉浸式體驗 |

### 視覺基準圖

- **Light Theme**: `./light_theme_hybrid_1772550833709.png`
- **Dark Theme**: `./dark_theme_bioluminescent_1772550852565.png`
- **Palette A (Glacier)**: `./palette_a_glacier_1772550268663.png`
- **Palette B (Treasury)**: `./palette_b_treasury_1772550287749.png`
- **Palette C (Bioluminescent)**: `./palette_c_bioluminescent_1772550304374.png`

### Badge 雙模式

- Light = solid pastel bg + dark text（e.g. `bg-COLOR-100 text-COLOR-700`）
- Dark = glass semi-transparent（e.g. `bg-COLOR/15 text-COLOR`）

---

## 2. 技術架構

### CSS Variables

- 格式: **Oklch**，定義於 `globals.css`
- Light mode 明度層次: background(0.955) > muted/50 content area > card(0.995)
- 包含 `float-slow`、`pulse-glow` 等全局動畫 keyframes

### 新增依賴

- `framer-motion` ^12.34.5

### 新增檔案

| 檔案 | 用途 |
|------|------|
| `lib/motion.ts` | 動畫常數與 spring config |
| `components/shared/page-transition.tsx` | 頁面切換過渡動畫 |
| `components/layout/DynamicBackground.tsx` | 雙主題動態背景（SVG 粒子） |

---

## 3. 實作進度

### ✅ 已完成

#### 基礎建設
- [x] `globals.css` css variables（Oklch 格式）+ 全局動畫 keyframes
- [x] `DynamicBackground` 元件：冰晶 (IceCrystal)、錨點 (Anchor) 等發光 SVG 動畫符號，雙主題適配
- [x] `DynamicBackground` 整合至 `(dashboard)/layout.tsx`

#### 共用元件 (Global)
- [x] `Card` 系列：毛玻璃 `backdrop-blur` + 半透明 `bg-card/60` + 微反光邊框；base style: `border-none shadow-sm dark:shadow-none hover:shadow-md transition-shadow duration-200`
- [x] `Sidebar` & `Topbar`：去除剛硬邊界，毛玻璃效果、柔和分隔線 `border-border/40`、擴大間距
- [x] `DataTable`：圓潤 `rounded-xl` + 柔和邊緣 `border-border/40`
- [x] `Table`：左右 padding `px-2` → `px-6`，舒適留白
- [x] 全頁面標題 h1 `font-semibold tracking-tight`，統一副標題 tracking
- [x] `theme-logo.tsx`：移除深色模式 `brightness-0 invert`（新 Logo 含漸層不適用）

#### 頁面調整
- [x] Dashboard `page.tsx`：Overview Cards 無邊界 + `shadow-sm`
- [x] Login & Auth layout：字體 + Logo 調整
- [x] ConnectButton：自訂 `ConnectModal` + `DropdownMenu` 取代 dapp-kit 預設按鈕
- [x] `Score Distribution` 圖表：Tooltip 毛玻璃、css variables 色系、Y 軸標籤截斷修正

#### Deals Pipeline (Kanban)
- [x] `DealCard` 引入 `@dnd-kit/sortable`，拖移浮空視覺 `shadow-lg scale-105 z-50`
- [x] `KanbanColumn` 使用 `useDroppable`，空欄可拖入
- [x] 滿版橫向滾動 `md:overflow-x-auto`，各 Column 最小寬度 + `gap-6`
- [x] `profileName` 改為 `break-all` 完整顯示長地址
- [x] Light mode 修復：column `bg-slate-100/80`、card `bg-white/80 shadow-sm`、hover 取消浮起

### 🔲 未完成

#### 圖表樣式重構
- [ ] `Activity Heatmap` 樣式重構
- [ ] `Pipeline Funnel` 樣式重構

#### Micro-animations & 互動
- [ ] 表格 (DataTable)、表單 (Forms)、按鈕 (Buttons) 的微動態與 Hover 效果
- [ ] 所有互動元素 Hover / Active 漸變動畫 (`transition-all`)

---

## 4. 技術 Gotchas

| 問題 | 解法 |
|------|------|
| `hsl()` 不能包裹 `oklch()` 值 | recharts fill/stroke 用 bare `var(--token)` |
| Auth layout SSR hang | 需 `"use client"` 才能 import DynamicBackground |
| 淺色 glass morphism 用 `bg-white/70` on white bg 無效 | 改用 `bg-card/90` + `shadow-black/[0.04]` |
| Badge `bg-COLOR/15 text-COLOR` 淺色背景對比不足 | 用 `bg-COLOR-100 text-COLOR-700` |
| Kanban card `hover:-translate-y` 被 ScrollArea clip | 改用 `!translate-y-0` + `p-1` padding |
| 新 Logo 含青色光束與白金漸層 | 不可套用 `brightness-0 invert` |

---

## 5. 相關檔案索引

### 核心樣式
- `packages/frontend/src/app/globals.css`
- `packages/frontend/src/lib/motion.ts`

### 佈局
- `packages/frontend/src/app/(dashboard)/layout.tsx`
- `packages/frontend/src/app/(auth)/layout.tsx`
- `packages/frontend/src/components/layout/DynamicBackground.tsx`
- `packages/frontend/src/components/layout/sidebar.tsx`
- `packages/frontend/src/components/layout/topbar.tsx`

### 共用元件
- `packages/frontend/src/components/ui/card.tsx`
- `packages/frontend/src/components/ui/table.tsx`
- `packages/frontend/src/components/ui/button.tsx`
- `packages/frontend/src/components/shared/data-table.tsx`
- `packages/frontend/src/components/shared/page-transition.tsx`

### 圖表
- `packages/frontend/src/components/charts/score-distribution.tsx`
- `packages/frontend/src/components/charts/activity-heatmap.tsx`
- `packages/frontend/src/components/charts/pipeline-funnel.tsx`

### Deals
- `packages/frontend/src/components/deal/kanban-board.tsx`
- `packages/frontend/src/components/deal/deal-card.tsx`
