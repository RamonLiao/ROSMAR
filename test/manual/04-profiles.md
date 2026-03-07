# 04 — Profiles

> Prerequisite: Login complete (01).

## 4.1 Create Profile

### Steps

- [ ] **4.1.1** Navigate to **Profiles** via sidebar
  - Verify: Page shows "Profiles" title and "Manage your customer profiles"
  - Verify: "Add Profile" button visible
  - Verify: Search input with placeholder "Search profiles..."
  - Verify: Table headers — Name, Address, Tier, Engagement, Created, Actions

- [ ] **4.1.2** Click **"Add Profile"**
  - Verify: Dialog opens — title "Create Profile", description "Add a new customer profile to your workspace."
  - Verify: Fields — Wallet Address (placeholder `0x...`), SuiNS Name (placeholder `name.sui`), Tags (placeholder `vip, early-adopter, whale`)

- [ ] **4.1.3** Leave address empty, click **"Create"**
  - Verify: Validation error on required Wallet Address field

- [ ] **4.1.4** Fill in:
  - Wallet Address: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`
  - SuiNS Name: `test-user.sui`
  - Tags: `vip, test, whale`
  - Click **"Create"**
  - Verify: Dialog closes
  - Verify: New profile appears in table
  - Verify: Tags displayed as badges

- [ ] **4.1.5** Create a second profile:
  - Address: `0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd`
  - SuiNS Name: (leave empty)
  - Tags: `prospect`
  - Verify: Appears in table without SuiNS name

---

## 4.2 Search Profiles

### Steps

- [ ] **4.2.1** Type `test-user` in search input
  - Verify: Table filters to show only matching profile(s)

- [ ] **4.2.2** Clear search
  - Verify: All profiles visible

---

## 4.3 Profile Detail Page

### Steps

- [ ] **4.3.1** Click **"View"** on the first profile row
  - Verify: Navigates to `/profiles/[id]`
  - Verify: H1 "Profile Detail"
  - Verify: Subtitle shows profile name or address
  - Verify: Back arrow button

- [ ] **4.3.2** Verify profile card:
  - Address displayed (truncated or full)
  - SuiNS name shown (if set)
  - Tier badge (e.g. Bronze, Silver, etc.)
  - Engagement score

- [ ] **4.3.3** Verify "Details" card:
  - Primary Address
  - SuiNS Name
  - Tier
  - Engagement Score
  - Created date

- [ ] **4.3.4** Verify "Tags" card:
  - Shows `vip`, `test`, `whale` as badges

- [ ] **4.3.5** Verify tabs exist:
  - Activity, Messages, Assets, Notes, Related Orgs

---

## 4.4 Edit Tags

### Steps

- [ ] **4.4.1** On profile detail, click **"Edit"** (Pencil icon)
  - Verify: Edit mode activates
  - Verify: Tags show as badges with X (remove) buttons
  - Verify: Input field appears with placeholder "Add tag and press Enter"

- [ ] **4.4.2** Click X on the `test` tag
  - Verify: Tag removed from list

- [ ] **4.4.3** Type `early-adopter` in tag input, press **Enter**
  - Verify: New tag badge appears

- [ ] **4.4.4** Click **"Save"**
  - Verify: Returns to view mode
  - Verify: Tags now show `vip`, `whale`, `early-adopter` (no `test`)

- [ ] **4.4.5** Refresh page
  - Verify: Tags persisted

---

## 4.5 Messaging (Profile Detail)

### Steps

- [ ] **4.5.1** On profile detail, click **"Messages"** tab

- [ ] **4.5.2** Select channel dropdown — verify options:
  - Email, Telegram, Discord

- [ ] **4.5.3** Select **"Telegram"**

- [ ] **4.5.4** Type in message textarea: `Hello from QA test`

- [ ] **4.5.5** Click **"Send"** (Send icon)
  - Verify: Message appears in "Message History" card
  - Verify: Shows channel badge ("Telegram"), status badge, message content, timestamp

- [ ] **4.5.6** Send another message via **"Discord"** channel
  - Verify: Both messages visible in history with correct channel badges

---

## 4.6 Related Orgs Tab

### Steps

- [ ] **4.6.1** On profile detail, click **"Related Orgs"** tab
  - Verify: "Related Organizations" card visible
  - Verify: Shows empty state "No related organizations" (or linked orgs if any)

> After completing test 05 (Organizations) with profile linking, revisit this tab to verify linked orgs appear.
