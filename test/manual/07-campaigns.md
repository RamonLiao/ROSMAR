# 07 — Campaigns

> Prerequisite: Login complete (01). At least 1 segment exists (06).

## 7.1 Create Campaign

### Steps

- [ ] **7.1.1** Navigate to **Campaigns** via sidebar
  - Verify: Page shows "Campaigns" title and "Create and manage marketing campaigns"
  - Verify: "New Campaign" button visible
  - Verify: Search input with placeholder "Search campaigns..."
  - Verify: Table headers — Campaign, Status, Segment, Created, Actions

- [ ] **7.1.2** Click **"New Campaign"**
  - Verify: Dialog opens — title "Create Campaign", description "Add a new marketing campaign to your workspace."
  - Verify: Fields — Name (placeholder `Q2 Outreach`), Description, Target Segment (select)

- [ ] **7.1.3** Verify segment dropdown:
  - Click "Select a segment"
  - Verify: Shows segments created in test 06
  - Verify: If no segments exist, shows "No segments found"

- [ ] **7.1.4** Fill in:
  - Name: `[TEST] Q2 Airdrop Campaign`
  - Description: `Airdrop tokens to VIP whales`
  - Target Segment: select `[TEST] VIP Whales` (or available segment)
  - Click **"Create"**
  - Verify: Dialog closes
  - Verify: Campaign appears in table
  - Verify: Status badge shows "draft" (gray)

---

## 7.2 Campaign Detail Page

### Steps

- [ ] **7.2.1** Click **"View"** on the campaign
  - Verify: Navigates to `/campaigns/[id]`
  - Verify: Shows campaign name, description, linked segment
  - Verify: Status visible

---

## 7.3 Campaign Workflow

### Steps

- [ ] **7.3.1** Navigate to campaign workflow page (`/campaigns/[id]/workflow`)
  - Verify: Workflow builder/viewer visible
  - Verify: Shows workflow steps (if configured)

- [ ] **7.3.2** Note available workflow actions:
  - airdrop-token
  - send-discord
  - send-telegram

---

## 7.4 Start Campaign

### Steps

- [ ] **7.4.1** On campaign detail or via action button, start the campaign:
  - If UI button exists: click "Start"
  - Or via API:
  ```
  curl -X POST http://localhost:3001/api/campaigns/{id}/start \
    -H "Cookie: access_token=..."
  ```
  - Verify: Status changes from "draft" to "active"
  - Verify: Status badge turns green

---

## 7.5 Pause Campaign

### Steps

- [ ] **7.5.1** Pause the running campaign:
  - If UI button: click "Pause"
  - Or via API:
  ```
  curl -X POST http://localhost:3001/api/campaigns/{id}/pause \
    -H "Cookie: access_token=..."
  ```
  - Verify: Status changes to "paused"
  - Verify: Status badge turns amber

---

## 7.6 Campaign Stats

### Steps

- [ ] **7.6.1** Check campaign stats:
  ```
  curl http://localhost:3001/api/campaigns/{id}/stats \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns stats object (profiles reached, actions executed, etc.)

---

## 7.7 Search Campaigns

### Steps

- [ ] **7.7.1** Type `Airdrop` in search
  - Verify: Only matching campaigns shown

- [ ] **7.7.2** Clear search
  - Verify: All campaigns visible

---

## 7.8 Status Badge Colors

### Steps

- [ ] **7.8.1** Verify status badges display correct colors across campaigns:
  - Draft: gray
  - Active: green
  - Paused: amber
  - Completed: teal
