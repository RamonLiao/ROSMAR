# 03 — Deals Pipeline

> Prerequisite: Login complete (01). At least 1 profile exists (04). Run 04 first if no profiles.

## 3.1 Create Deal

### Steps

- [ ] **3.1.1** Navigate to **Deals** via sidebar
  - Verify: Page shows "Deals Pipeline" title
  - Verify: Subtitle "Drag and drop deals to update stages"
  - Verify: Kanban view is default (6 columns visible)
  - Verify: "New Deal" button visible in top-right

- [ ] **3.1.2** Click **"New Deal"**
  - Verify: Dialog opens with title "Create Deal"
  - Verify: Description "Add a new deal to your pipeline."
  - Verify: Fields — Profile (select), Title, Amount USD, Stage (select), Notes

- [ ] **3.1.3** Leave all fields empty, click **"Create"**
  - Verify: Validation error on required fields (Profile, Title, Amount)

- [ ] **3.1.4** Fill in:
  - Profile: select any profile from dropdown
  - Title: `[TEST] Enterprise Deal Q2`
  - Amount USD: `50000`
  - Stage: `Prospecting`
  - Notes: `Test deal for QA`
  - Click **"Create"**
  - Verify: Dialog closes
  - Verify: New deal card appears in "Prospecting" column
  - Verify: Card shows title and amount

- [ ] **3.1.5** Create a second deal:
  - Title: `[TEST] Startup Pilot`
  - Amount: `5000`
  - Stage: `Qualification`
  - Verify: Appears in "Qualification" column

---

## 3.2 Kanban Drag-and-Drop

**Why manual:** Drag-and-drop requires real mouse interaction.

### Steps

- [ ] **3.2.1** Locate `[TEST] Enterprise Deal Q2` in "Prospecting" column

- [ ] **3.2.2** Click and hold the deal card, drag it to **"Qualification"** column
  - Verify: Visual drag feedback (card follows cursor, drop zone highlighted)
  - Verify: Card drops into "Qualification" column
  - Verify: "Prospecting" column count decreases, "Qualification" count increases

- [ ] **3.2.3** Drag same deal to **"Proposal"** column
  - Verify: Successfully moves

- [ ] **3.2.4** Drag deal to **"Closed Won"**
  - Verify: Deal appears in "Closed Won" column

- [ ] **3.2.5** Drag deal to **"Closed Lost"**
  - Verify: Deal moves to "Closed Lost"

- [ ] **3.2.6** Drag deal back to **"Prospecting"**
  - Verify: Re-opening a closed deal works

- [ ] **3.2.7** Refresh page (F5)
  - Verify: Deal stage persisted (shows in last dragged column)

---

## 3.3 Deal Search

### Steps

- [ ] **3.3.1** In search input (placeholder "Search deals..."), type `Enterprise`
  - Verify: Only `[TEST] Enterprise Deal Q2` visible
  - Verify: Other deals hidden

- [ ] **3.3.2** Clear search
  - Verify: All deals visible again

- [ ] **3.3.3** Type a non-matching string like `zzzzz`
  - Verify: No deals shown (empty columns)

---

## 3.4 View Toggle (Kanban / List)

### Steps

- [ ] **3.4.1** Click **List view** button (List icon, right of search)
  - Verify: View switches to table
  - Verify: Subtitle changes to "Browse and search all deals"
  - Verify: Table columns: Title, Amount (USD), Stage, Profile
  - Verify: Deals visible in table rows

- [ ] **3.4.2** Click a deal title in the table
  - Verify: Navigates to deal detail page (`/deals/[id]`)

- [ ] **3.4.3** Go back, click **Kanban view** button (LayoutGrid icon)
  - Verify: Returns to kanban board

---

## 3.5 Deal Detail Page

### Steps

- [ ] **3.5.1** Click any deal card on kanban (or title in list view)
  - Verify: Navigates to `/deals/[id]`
  - Verify: Shows deal title as H1
  - Verify: "Deal details" subtitle
  - Verify: Back arrow button (top-left)
  - Verify: "Edit" button (Pencil icon)

- [ ] **3.5.2** Verify "Overview" card content:
  - Amount: shows `$50,000` (formatted)
  - Stage: shows current stage name
  - Profile: shows profile ID
  - Created: shows date

- [ ] **3.5.3** Verify "Notes" card:
  - Shows `Test deal for QA`

---

## 3.6 Edit Deal

### Steps

- [ ] **3.6.1** On deal detail page, click **"Edit"** (Pencil icon)
  - Verify: Form inputs appear (Title, Amount USD, Stage select, Profile ID disabled)
  - Verify: "Cancel" (X) and "Save" buttons replace "Edit"

- [ ] **3.6.2** Change title to `[TEST] Enterprise Deal Q2 - Updated`

- [ ] **3.6.3** Change amount to `75000`

- [ ] **3.6.4** Change stage to **"Negotiation"** via dropdown

- [ ] **3.6.5** Update notes to `Updated during QA testing`

- [ ] **3.6.6** Click **"Save"**
  - Verify: Returns to view mode
  - Verify: All changes reflected (title, amount $75,000, stage Negotiation, notes)

- [ ] **3.6.7** Click back arrow, verify kanban
  - Verify: Deal now in "Negotiation" column with updated title

---

## 3.7 Archive Deal

### Steps

- [ ] **3.7.1** Navigate to a deal detail page (e.g. `[TEST] Startup Pilot`)

- [ ] **3.7.2** Look for archive action (may be button on detail page or via API)
  - Note: Check if archive button exists on UI; if not, test via API:
  ```
  curl -X PUT http://localhost:3001/api/deals/{id}/archive \
    -H "Cookie: access_token=..."
  ```
  - Verify: Deal marked as archived

- [ ] **3.7.3** Return to deals list
  - Verify: Archived deal no longer appears in kanban/list (or shows archived state)

---

## 3.8 Audit Trail

### Steps

- [ ] **3.8.1** Navigate to a deal that has been edited/stage-changed

- [ ] **3.8.2** Check audit trail (if visible on detail page, or via API):
  ```
  curl http://localhost:3001/api/deals/{id}/audit \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns list of audit events
  - Verify: Events include: create, stage changes, edits, archive
  - Verify: Each event has timestamp, action type, actor
