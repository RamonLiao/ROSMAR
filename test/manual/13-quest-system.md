# 13 — Quest System (Q3)

> Prerequisite: Login complete (01). Profiles created (04).

## 13.1 Quest List Page

### Steps

- [ ] **13.1.1** Navigate to **Quests** via sidebar (or `/quests`)
  - Verify: Page title visible
  - Verify: "New Quest" or "Create Quest" button visible
  - Verify: Empty state shows "No quests" (or quest cards if previously created)

---

## 13.2 Create Quest

### Steps

- [ ] **13.2.1** Click **"New Quest"** (or navigate to `/quests/new`)
  - Verify: Quest builder form visible
  - Verify: H1 "Create Quest" (or similar)
  - Verify: Fields — Quest Name, Description, Reward Type select, Steps list

- [ ] **13.2.2** Verify Reward Type options:
  - BADGE
  - TOKEN
  - NFT
  - POINTS

- [ ] **13.2.3** Fill in quest details:
  - Name: `[TEST] Onboarding Quest`
  - Description: `Complete basic CRM actions to earn a badge`
  - Reward Type: `BADGE`

- [ ] **13.2.4** Add quest steps:
  - Click **"Add Step"**
  - Verify: Step editor appears with fields (action type, description, verification criteria)
  - Fill in Step 1: e.g. "Connect wallet" / type "wallet_connect"
  - Click **"Add Step"** again
  - Fill in Step 2: e.g. "Create first profile" / type "create_profile"

- [ ] **13.2.5** Click **"Create Quest"**
  - Verify: Redirects to quest list (or quest detail)
  - Verify: Quest card visible with name, description, step count
  - Verify: Status badge shows "Active" (or "Inactive" depending on default)

---

## 13.3 Quest Detail

### Steps

- [ ] **13.3.1** Click on `[TEST] Onboarding Quest` card
  - Verify: Navigates to `/quests/[id]`
  - Verify: Shows quest name, description, reward type
  - Verify: Step list visible with step numbers

---

## 13.4 Quest Progress

### Steps

- [ ] **13.4.1** Check progress for a profile:
  - Via API:
  ```
  curl http://localhost:3001/api/quests/{questId}/progress/{profileId} \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns progress object (completed steps, total steps, percentage)

- [ ] **13.4.2** Verify progress card (if visible on quest detail or profile page):
  - Shows progress bar
  - Shows completed / total steps

---

## 13.5 Claim Quest Step

### Steps

- [ ] **13.5.1** Claim a completed step:
  ```
  curl -X POST http://localhost:3001/api/quests/{questId}/steps/{stepId}/claim \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"profileId": "{profileId}"}'
  ```
  - Verify: Step marked as completed
  - Verify: Progress updates

- [ ] **13.5.2** Attempt to claim same step again
  - Verify: Error or no-op (duplicate claim prevented)

---

## 13.6 Quest Badge (SBT)

> Requires `SUI_DRY_RUN=false` and testnet deployment for on-chain verification.

### Steps

- [ ] **13.6.1** Complete all steps of a quest

- [ ] **13.6.2** Verify badge minting:
  - Check if a QuestBadge NFT was minted (soulbound token)
  - With `SUI_DRY_RUN=true`: verify mock result returned
  - With `SUI_DRY_RUN=false`: check Sui explorer for badge object

---

## 13.7 Edit Quest

### Steps

- [ ] **13.7.1** On quest detail, update quest via API:
  ```
  curl -X PUT http://localhost:3001/api/quests/{id} \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"name": "[TEST] Onboarding Quest - Updated", "isActive": false}'
  ```
  - Verify: Name updated
  - Verify: Status changes to Inactive

- [ ] **13.7.2** Return to quest list
  - Verify: Updated name and Inactive badge shown
