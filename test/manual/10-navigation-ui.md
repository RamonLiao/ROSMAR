# 10 — Navigation, UI & Analytics

> Prerequisite: Login complete (01). Best tested last with data populated from tests 02-09.

## 10.1 Sidebar Navigation

### Steps

- [ ] **10.1.1** Verify sidebar is visible on all dashboard pages
  - Verify: Logo "ROSMAR" at top

- [ ] **10.1.2** Verify all nav items exist and are clickable:

  **CRM Core group:**
  - [ ] "Dashboard" (LayoutDashboard icon) -> navigates to `/`
  - [ ] "Profiles" (Users icon) -> navigates to `/profiles`
  - [ ] "Organizations" (Building2 icon) -> navigates to `/organizations`
  - [ ] "Deals" (Handshake icon) -> navigates to `/deals`

  **Engagement group:**
  - [ ] "Segments" (Filter icon) -> navigates to `/segments`
  - [ ] "Campaigns" (Megaphone icon) -> navigates to `/campaigns`
  - [ ] "Tickets" (Ticket icon) -> navigates to `/tickets`

  **Tools group:**
  - [ ] "Vault" (Vault icon) -> navigates to `/vault`
  - [ ] "Analytics" (BarChart3 icon) -> navigates to `/analytics`
  - [ ] "Settings" (Settings icon) -> navigates to `/settings/workspace`

- [ ] **10.1.3** Active page highlight
  - Verify: Current page's nav item is visually highlighted/active

- [ ] **10.1.4** Sidebar collapse
  - Click collapse button (ChevronLeft icon)
  - Verify: Sidebar collapses to icon-only mode
  - Verify: Click again to expand
  - Verify: Navigation still works in collapsed mode

---

## 10.2 Topbar

### Steps

- [ ] **10.2.1** Verify topbar elements:
  - Workspace selector (left side) — shows workspace name
  - Theme toggle button
  - Notification bell
  - User avatar/menu (right side)

- [ ] **10.2.2** Theme toggle
  - Click theme toggle button
  - Verify: Theme switches between light and dark mode
  - Verify: All components render correctly in both themes
  - Verify: Toggle again to switch back

---

## 10.3 Notifications

### Steps

- [ ] **10.3.1** Click notification bell in topbar
  - Verify: Popover opens with "Notifications" header

- [ ] **10.3.2** If notifications exist:
  - Verify: Each item shows title, body (truncated), timestamp
  - Verify: Unread items have blue dot indicator
  - Verify: Unread count badge on bell icon (max "99+")

- [ ] **10.3.3** Click a notification
  - Verify: Marked as read (blue dot disappears)

- [ ] **10.3.4** Click **"Mark all read"** (if unread count > 0)
  - Verify: All notifications marked read
  - Verify: Unread count badge disappears

- [ ] **10.3.5** If no notifications:
  - Verify: Shows "No notifications" empty state

---

## 10.4 User Menu

### Steps

- [ ] **10.4.1** Click user avatar/menu in topbar
  - Verify: Dropdown shows "Settings" (User icon) and "Logout" (LogOut icon)

- [ ] **10.4.2** Click **"Settings"**
  - Verify: Navigates to `/settings/workspace`

---

## 10.5 Command Palette

### Steps

- [ ] **10.5.1** Press `Cmd+K` (Mac) or `Ctrl+K` (Windows)
  - Verify: Command palette dialog opens
  - Note: Record what commands/search are available

- [ ] **10.5.2** Type a page name (e.g., "Deals")
  - Verify: Matching result appears

- [ ] **10.5.3** Select result
  - Verify: Navigates to the page, palette closes

- [ ] **10.5.4** Press `Escape`
  - Verify: Palette closes without navigation

---

## 10.6 Dashboard

### Steps

- [ ] **10.6.1** Navigate to Dashboard (`/`)
  - Verify: "Dashboard" title, "Welcome to ROSMAR CRM" subtitle

- [ ] **10.6.2** Verify 4 stat cards:
  - "Total Profiles" — shows count from test 04
  - "Active Deals" — shows count from test 03
  - "Pipeline Total" — shows total deal value (e.g. `$55,000`)
  - "Segments" — shows count from test 06

- [ ] **10.6.3** Verify chart tabs:
  - "Engagement" tab (default) -> Score Distribution chart
  - "Activity" tab -> Activity Heatmap chart
  - "Pipeline" tab -> Deal Pipeline Funnel chart

- [ ] **10.6.4** Click each tab
  - Verify: Chart switches without error
  - Verify: Charts render with data (or show appropriate empty state)

---

## 10.7 Analytics Page

### Steps

- [ ] **10.7.1** Navigate to **Analytics** (`/analytics`)
  - Verify: "Analytics" title, "CRM engagement, activity, and pipeline insights"

- [ ] **10.7.2** Verify 3 summary cards:
  - "Total Profiles" — count
  - "Avg Engagement Score" — 0-100 value
  - "Pipeline Value" — formatted currency + deal count

- [ ] **10.7.3** Verify 3 chart cards:
  - "Engagement Score Distribution" — histogram/bar chart
  - "Activity Heatmap" — grid chart (by day and hour)
  - "Deal Pipeline" — funnel/bar chart by stage

- [ ] **10.7.4** Charts with no data:
  - If empty, verify: "No deals" or appropriate empty state (no crash)

---

## 10.8 Page Transitions

### Steps

- [ ] **10.8.1** Navigate between pages rapidly (click sidebar items)
  - Verify: Smooth page transitions (framer-motion animations)
  - Verify: No flash of empty content
  - Verify: No layout shift during transitions

---

## 10.9 Responsive Layout

### Steps

- [ ] **10.9.1** Resize browser window to narrow width (~768px)
  - Verify: Sidebar collapses or becomes hidden
  - Verify: Content area adjusts (padding changes from `p-10` to `p-8`)
  - Verify: Tables and cards stack or scroll horizontally

- [ ] **10.9.2** Resize back to full width
  - Verify: Layout returns to normal

---

## 10.10 Error States

### Steps

- [ ] **10.10.1** Stop BFF server (`Ctrl+C` on `pnpm dev` in packages/bff)

- [ ] **10.10.2** Navigate to Profiles page
  - Verify: Error message displayed (not a blank page or unhandled crash)
  - Verify: "Failed to load..." or similar error message

- [ ] **10.10.3** Restart BFF server

- [ ] **10.10.4** Refresh page
  - Verify: Data loads correctly again
