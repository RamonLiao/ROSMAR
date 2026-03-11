# 14 — Escrow, SAFT & Deal Documents

> Prerequisite: Login complete (01). At least 1 deal exists (03). Profile created (04).

## 14.1 Deal Documents Tab

### Steps

- [ ] **14.1.1** Navigate to a deal detail page (`/deals/[id]`)
  - Verify: Three tabs visible — Overview, Documents, Escrow

- [ ] **14.1.2** Click **"Documents"** tab
  - Verify: "Upload Document" button visible
  - Verify: Empty state "No documents yet" (or existing documents)

---

## 14.2 Upload Deal Document

### Steps

- [ ] **14.2.1** Click **"Upload Document"**
  - Verify: Upload form appears (document name input, file/content input)

- [ ] **14.2.2** Fill in:
  - Name: `[TEST] Term Sheet v1`
  - Content/file: test content or small file
  - Click submit
  - Verify: Loading state (encrypting + uploading to Walrus)
  - Verify: Document appears in list

- [ ] **14.2.3** Verify document row:
  - File icon
  - Name: `[TEST] Term Sheet v1`
  - File size displayed
  - Relative timestamp (e.g. "just now")
  - "Encrypted" badge (if Seal policy ID set)
  - Trash delete button

- [ ] **14.2.4** Upload second document:
  - Name: `[TEST] DD Report`
  - Verify: Both documents listed

---

## 14.3 Delete Deal Document

### Steps

- [ ] **14.3.1** Click trash icon on `[TEST] DD Report`
  - Verify: Document removed from list
  - Verify: `[TEST] Term Sheet v1` still present

---

## 14.4 Escrow Tab — Create Escrow

### Steps

- [ ] **14.4.1** Click **"Escrow"** tab
  - Verify: If no escrow exists, shows create form
  - Verify: Form fields — Payee Address, Total Amount, Token Type, Arbiter Threshold, Arbitrators

- [ ] **14.4.2** Fill in escrow details:
  - Payee Address: valid Sui address (e.g. `0xabcdef...`)
  - Total Amount: `10000`
  - Token Type: `SUI`
  - Arbiter Threshold: `2` (of 3 arbitrators)
  - Arbitrators: 3 comma-separated Sui addresses
  - Click **"Create Escrow"**
  - Verify: Loading state
  - Verify: Escrow panel replaces form

- [ ] **14.4.3** Verify escrow panel displays:
  - State badge: `CREATED`
  - Payer address (current user)
  - Payee address
  - Total amount + token type
  - Arbitrators listed as badges
  - Release progress bar (0%)

---

## 14.5 Fund Escrow

> Note: On-chain fund TX is currently a stub — Prisma-only update.

### Steps

- [ ] **14.5.1** Verify **"Fund"** button visible (only shown to payer when state = CREATED)

- [ ] **14.5.2** Click **"Fund"**
  - Verify: `FundDialog` opens with amount confirmation
  - Confirm funding
  - Verify: State changes to `FUNDED`
  - Verify: Fund button disappears, Release/Dispute buttons appear

---

## 14.6 Release Funds

### Steps

- [ ] **14.6.1** With escrow in `FUNDED` state, click **"Release"**
  - Verify: `ReleaseDialog` opens
  - Enter release amount (partial or full)
  - Confirm
  - Verify: Release progress bar updates
  - Verify: If fully released, state changes to `COMPLETED`

---

## 14.7 Dispute Escrow

### Steps

- [ ] **14.7.1** Create a new escrow (repeat 14.4) and fund it (14.5)

- [ ] **14.7.2** Click **"Dispute"**
  - Verify: `DisputeDialog` opens
  - Enter dispute reason
  - Confirm
  - Verify: State changes to `DISPUTED`
  - Verify: Release/Dispute buttons replaced by arbiter voting UI

---

## 14.8 Arbiter Vote

> Requires logging in as an arbiter address, or testing via API.

### Steps

- [ ] **14.8.1** As arbiter, on disputed escrow:
  - Verify: `VoteDialog` visible (only for arbiter addresses)
  - Or via API:
  ```
  curl -X POST http://localhost:3001/api/deals/{dealId}/escrow/dispute/vote \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"vote": "release"}'
  ```
  - Verify: Vote recorded
  - Verify: If threshold reached, escrow resolved (COMPLETED or REFUNDED)

---

## 14.9 SAFT Template Management

### Steps

- [ ] **14.9.1** On Documents tab (or Escrow tab), find SAFT section
  - Verify: `SaftTemplatePicker` component visible
  - Verify: "Create New" button for SAFT templates

- [ ] **14.9.2** Click **"Create New"** SAFT template
  - Verify: `SaftTermsForm` shown
  - Fill in: Token Symbol, Total Tokens, Vesting Months
  - Save
  - Verify: Template appears in list with radio select

- [ ] **14.9.3** Select a SAFT template
  - Verify: Template details shown (token symbol, total tokens, vesting months)

- [ ] **14.9.4** Create a second SAFT template
  - Verify: Both templates listed, radio select switches between them

---

## 14.10 Vesting Timeline

### Steps

- [ ] **14.10.1** If escrow has vesting configured:
  - Verify: `VestingTimeline` component visible on escrow panel
  - Verify: Shows vesting milestones or linear schedule
  - Verify: Each milestone shows date, amount, completion status

- [ ] **14.10.2** Complete a vesting milestone (via API):
  ```
  curl -X POST http://localhost:3001/api/deals/{dealId}/escrow/vesting/milestone \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"milestoneIndex": 0}'
  ```
  - Verify: Milestone marked as complete
  - Verify: Timeline updates
