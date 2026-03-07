# 06 — Segments

> Prerequisite: Login complete (01). Profiles created (04) — at least 2 profiles with different tags/tiers.

## 6.1 Create Segment

### Steps

- [ ] **6.1.1** Navigate to **Segments** via sidebar
  - Verify: Page shows "Segments" title and "Create and manage customer segments"
  - Verify: "New Segment" button visible
  - Verify: Search input with placeholder "Search segments..."
  - Verify: Table headers — Name, Type, Members, Description, Created, Actions

- [ ] **6.1.2** Click **"New Segment"**
  - Verify: Navigates to `/segments/new`
  - Verify: H1 "Create Segment"
  - Verify: Subtitle "Define rules to automatically segment your profiles"
  - Verify: Back arrow button, "Save Segment" button

- [ ] **6.1.3** Verify form sections:
  - "Segment Details" card — Name input (placeholder `e.g., Whale Collectors`), Description textarea
  - "Segmentation Rules" card — Rule builder component

---

## 6.2 Fill Segment Form

### Steps

- [ ] **6.2.1** Enter segment name: `[TEST] VIP Whales`

- [ ] **6.2.2** Enter description: `Profiles tagged as VIP or whale`

- [ ] **6.2.3** Configure rules in rule builder:
  - Add rule: tag contains `vip` (or equivalent rule based on rule builder UI)
  - Add rule: tag contains `whale`
  - Note: Record exact rule builder interaction (fields, operators, values)

- [ ] **6.2.4** Click **"Save Segment"**
  - Verify: Redirected to segments list (or segment detail page)
  - Verify: New segment appears in table
  - Verify: Type shows "Dynamic" badge
  - Verify: Members count shows matching profiles

---

## 6.3 Segment Detail Page

### Steps

- [ ] **6.3.1** Click **"View"** on `[TEST] VIP Whales`
  - Verify: Navigates to `/segments/[id]`
  - Verify: Shows segment name, description, rules, member list

- [ ] **6.3.2** Verify member profiles listed
  - Verify: Profiles with `vip` or `whale` tags appear
  - Verify: Profiles without these tags do NOT appear

---

## 6.4 Edit Segment

### Steps

- [ ] **6.4.1** On segment detail, find edit controls

- [ ] **6.4.2** Change name to `[TEST] VIP Whales - Updated`

- [ ] **6.4.3** Update rules (e.g., add additional condition)

- [ ] **6.4.4** Save changes
  - Verify: Name updated
  - Verify: Member count may change based on new rules

---

## 6.5 Refresh Segment

### Steps

- [ ] **6.5.1** First, go to Profiles and update a profile's tags to include `whale`

- [ ] **6.5.2** Return to segment detail

- [ ] **6.5.3** Trigger segment refresh (button or API):
  ```
  curl -X POST http://localhost:3001/api/segments/{id}/refresh \
    -H "Cookie: access_token=..."
  ```
  - Verify: Member count updates to include newly matching profile

---

## 6.6 Search Segments

### Steps

- [ ] **6.6.1** On segments list page, type `VIP` in search
  - Verify: Only matching segments shown

- [ ] **6.6.2** Clear search
  - Verify: All segments visible

---

## 6.7 Delete Segment

### Steps

- [ ] **6.7.1** Identify segment to delete (e.g., a test segment)

- [ ] **6.7.2** Delete via UI action or API:
  ```
  curl -X DELETE http://localhost:3001/api/segments/{id} \
    -H "Cookie: access_token=..."
  ```
  - Verify: Segment removed from list
  - Verify: Profiles NOT deleted (only segment association removed)
