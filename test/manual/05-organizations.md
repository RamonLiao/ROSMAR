# 05 — Organizations

> Prerequisite: Login complete (01). Profiles created (04).

## 5.1 Create Organization

### Steps

- [ ] **5.1.1** Navigate to **Organizations** via sidebar
  - Verify: Page shows "Organizations" title and "Manage company and organization profiles"
  - Verify: "New Organization" button visible
  - Verify: Search input with placeholder "Search organizations..."
  - Verify: Table headers — Organization, Domain, Tags, Members, Actions

- [ ] **5.1.2** Click **"New Organization"**
  - Verify: Dialog — title "Create Organization", description "Add a new organization to your workspace."
  - Verify: Fields — Name (placeholder `Acme Corp`), Domain (placeholder `acme.com`), Tags (placeholder `enterprise, partner, prospect`)

- [ ] **5.1.3** Fill in:
  - Name: `[TEST] Acme Corp`
  - Domain: `acme.com`
  - Tags: `enterprise, partner`
  - Click **"Create"**
  - Verify: Dialog closes
  - Verify: Org appears in table with domain and tag badges

- [ ] **5.1.4** Create second org:
  - Name: `[TEST] Startup Inc`
  - Domain: `startup.io`
  - Tags: `prospect`

---

## 5.2 Search Organizations

### Steps

- [ ] **5.2.1** Type `Acme` in search
  - Verify: Only `[TEST] Acme Corp` visible

- [ ] **5.2.2** Clear search
  - Verify: All orgs visible

---

## 5.3 Organization Detail Page

### Steps

- [ ] **5.3.1** Click **"View"** on `[TEST] Acme Corp`
  - Verify: Navigates to `/organizations/[id]`
  - Verify: H1 shows "Acme Corp" (or full name)
  - Verify: "Organization details" subtitle
  - Verify: Back arrow, "Edit" button

- [ ] **5.3.2** Verify "Overview" card:
  - Domain: `acme.com` (with globe icon)
  - Members: `0`
  - Tags: `enterprise`, `partner` badges
  - Created: date

- [ ] **5.3.3** Verify "Members" card:
  - Shows "No members yet"
  - "Add Member" button visible

---

## 5.4 Edit Organization

### Steps

- [ ] **5.4.1** Click **"Edit"** on org detail
  - Verify: Form inputs appear (Name, Domain, Tags with add/remove)

- [ ] **5.4.2** Change name to `[TEST] Acme Corporation`

- [ ] **5.4.3** Change domain to `acme-corp.com`

- [ ] **5.4.4** Remove `prospect` tag (if any), add `verified` tag

- [ ] **5.4.5** Click **"Save"**
  - Verify: Changes reflected in view mode

---

## 5.5 Link Profile to Organization

### Steps

- [ ] **5.5.1** On org detail page, in "Members" card, click **"Add Member"**
  - Verify: Search input appears (placeholder "Search profiles...")

- [ ] **5.5.2** Type in search to find profile from test 04
  - Verify: Dropdown shows matching profiles with name/address and tier badge

- [ ] **5.5.3** Click a profile in the dropdown
  - Verify: Profile added to members list
  - Verify: Members count in Overview card increases to 1
  - Verify: Member row shows name/address and tier badge

- [ ] **5.5.4** Add a second profile
  - Verify: Members count = 2

---

## 5.6 Unlink Profile from Organization

### Steps

- [ ] **5.6.1** In members list, click delete button (X) on one member
  - Verify: Member removed from list
  - Verify: Members count decreases

---

## 5.7 Verify Cross-Reference

### Steps

- [ ] **5.7.1** Navigate to the profile that was linked (Profiles > View)

- [ ] **5.7.2** Click **"Related Orgs"** tab
  - Verify: `[TEST] Acme Corporation` appears in the list
  - Verify: Shows domain and tags

- [ ] **5.7.3** Click the org name
  - Verify: Navigates to org detail page
