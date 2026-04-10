# 16 — Whale Alerts

> Prerequisite: Login complete (01). Workspace created (02). Rust indexer running (or testnet activity producing wallet events).

## 16.1 Whale Page

### Steps

- [ ] **16.1.1** Navigate to **Whales** (`/whales`) via sidebar
  - Verify: Page shows 3 cards — Threshold Config, Recent Whale Alerts, Top Whale Profiles

---

## 16.2 Threshold Configuration

### Steps

- [ ] **16.2.1** In **ThresholdConfig** card:
  - Verify: Table of token/amount rows (may be empty)
  - Verify: "Add" button visible

- [ ] **16.2.2** Click **"Add"** to add a new threshold
  - Enter Token: `SUI`, Amount: `10000`
  - Verify: Row added to table

- [ ] **16.2.3** Add a second threshold:
  - Token: `USDC`, Amount: `50000`
  - Verify: Both rows visible

- [ ] **16.2.4** Click **"Save"** (button appears when changes are dirty)
  - Verify: `PUT /workspaces/:id/whale-thresholds` called
  - Verify: Success feedback

- [ ] **16.2.5** Refresh page
  - Verify: Saved thresholds persist

- [ ] **16.2.6** Delete a threshold row (click delete icon on USDC row)
  - Click **"Save"**
  - Verify: Only SUI threshold remains

---

## 16.3 Recent Whale Alerts

### Steps

- [ ] **16.3.1** Check **RecentWhaleAlerts** card:
  - Verify: Table columns — Time, Address (truncated), Amount (amber), Token (badge), Type, Profile link
  - Verify: Auto-refreshes every 30 seconds (observe timestamp or network tab)

- [ ] **16.3.2** If alerts exist:
  - Click a "View" profile link
  - Verify: Navigates to `/profiles/:id`

- [ ] **16.3.3** Click **"Load More"** (if available)
  - Verify: Loads next 50 alerts (pagination)

- [ ] **16.3.4** If no alerts:
  - Verify: Empty state message (no crash)

---

## 16.4 Top Whale Profiles

### Steps

- [ ] **16.4.1** Check **TopWhaleProfiles** card:
  - Verify: Ranked table — #, Profile name/SuiNS, Address (truncated), Tags (up to 3 badges), Total Balance

- [ ] **16.4.2** Click a profile name
  - Verify: Navigates to `/profiles/:id`

- [ ] **16.4.3** If no profiles qualify:
  - Verify: Empty state or "No whale profiles" message
