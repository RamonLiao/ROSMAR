# 02 — Workspace Management

## 2.1 Default Workspace on First Login

### Steps

- [ ] **2.1.1** Login with a wallet that has never logged in before
  - Verify: Dashboard loads (workspace auto-created)
  - Verify: Topbar workspace selector shows a workspace name

---

## 2.2 Create Workspace

### Steps

- [ ] **2.2.1** Click workspace name dropdown in topbar
  - Verify: Dropdown opens showing current workspace (with checkmark)
  - Verify: "Create Workspace" option visible (with + icon)
  - Verify: "Manage Workspaces" option visible (with Settings icon)

- [ ] **2.2.2** Click **"Create Workspace"**
  - Verify: Dialog opens with title "Create Workspace"
  - Verify: Input field with placeholder "Workspace name"
  - Verify: "Cancel" and "Create" buttons

- [ ] **2.2.3** Leave name empty, click "Create"
  - Verify: Validation prevents submission (button disabled or error shown)

- [ ] **2.2.4** Enter `[TEST] QA Workspace`, click **"Create"**
  - Verify: Dialog closes
  - Verify: New workspace appears in dropdown list

---

## 2.3 Switch Workspace

### Steps

- [ ] **2.3.1** Click workspace dropdown in topbar
  - Verify: Shows list of workspaces (at least 2 after 2.2)

- [ ] **2.3.2** Click the workspace NOT currently active (e.g. `[TEST] QA Workspace`)
  - Verify: Dropdown closes
  - Verify: Topbar now shows selected workspace name
  - Verify: Dashboard data refreshes (stats may change)
  - Verify: Sidebar still visible, no layout break

- [ ] **2.3.3** Switch back to original workspace
  - Verify: Data returns to original state

---

## 2.4 Invite Member

> Prerequisite: Need a second wallet address to invite.

### Steps

- [ ] **2.4.1** Navigate to **Settings > Members** (sidebar: Settings, then Members tab or `/settings/members`)
  - Verify: Page shows "Workspace Members" title
  - Verify: Table shows current user as "owner"
  - Verify: "Invite Member" button visible

- [ ] **2.4.2** Click **"Invite Member"**
  - Verify: Dialog opens with title "Invite Member"
  - Verify: Fields: "Wallet Address" (placeholder `0x...`), "Role" dropdown

- [ ] **2.4.3** Enter a valid Sui address, select role **"Member"**, click **"Add Member"**
  - Verify: Dialog closes
  - Verify: New member appears in table with role "member"
  - Verify: "Joined" column shows today's date

- [ ] **2.4.4** Invite another address with role **"Viewer"**
  - Verify: Appears in table with role "viewer"

### Failure Cases

- [ ] **2.4.5** Invite with empty address
  - Verify: Validation error, no submission

- [ ] **2.4.6** Invite same address twice
  - Verify: Error message (duplicate member)

---

## 2.5 Remove Member

### Steps

- [ ] **2.5.1** In members table, find the "viewer" member added in 2.4.4

- [ ] **2.5.2** Click delete button (X icon) on that row
  - Verify: Member removed from table
  - Verify: Owner row is NOT removable (no delete button on owner)

---

## 2.6 Passkey Registration

**Why manual:** Requires WebAuthn biometric interaction.

### Steps

- [ ] **2.6.1** Navigate to **Settings > Workspace** (`/settings/workspace`)
  - Verify: Page shows "Workspace Settings"
  - Verify: "Passkey Authentication" card visible
  - Verify: Description mentions Face ID, Touch ID, Windows Hello

- [ ] **2.6.2** Click **"Register Passkey"** (Fingerprint icon)
  - Verify: Browser biometric prompt appears

- [ ] **2.6.3** Complete biometric authentication
  - Verify: Success message "Passkey registered successfully" with green checkmark

- [ ] **2.6.4** Go to `/login`, logout first, then try **"Use Passkey"** login
  - Verify: Can login with registered passkey (links to test 01, step 1.3)

---

## 2.7 Workspace Settings Update

### Steps

- [ ] **2.7.1** Navigate to `/settings/workspace`
  - Verify: "General Settings" card shows current workspace name

- [ ] **2.7.2** Change workspace name to `[TEST] Updated Workspace`

- [ ] **2.7.3** Add description: `Test workspace for QA`

- [ ] **2.7.4** Click **"Save Changes"** (Save icon)
  - Verify: Success message "Saved successfully."
  - Verify: Topbar workspace name updates to new name

- [ ] **2.7.5** Refresh page (F5)
  - Verify: Changes persisted (name and description still show updated values)
