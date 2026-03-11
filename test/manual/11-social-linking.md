# 11 — Social Linking

> Prerequisite: Login complete (01). At least 1 profile exists (04).

**Why manual:** Requires OAuth popup interactions with Discord, X (Twitter), and Telegram.

## 11.1 Navigate to Social Tab

### Steps

- [ ] **11.1.1** Navigate to a profile detail page (`/profiles/[id]`)

- [ ] **11.1.2** Click **"Social"** tab
  - Verify: 2×2 grid of platform cards (Discord, Telegram, X/Twitter, Apple)
  - Verify: Each card shows platform name, icon, and "Link [Platform]" button
  - Verify: Unlinked cards show "Not linked" state

---

## 11.2 Link Discord

> Skip if no Discord account available. Requires `DISCORD_CLIENT_ID` configured.

### Steps

- [ ] **11.2.1** Click **"Link Discord"** button on Discord card
  - Verify: OAuth popup window opens
  - Verify: Discord authorization page shown (asks to grant access)

- [ ] **11.2.2** Approve Discord OAuth
  - Verify: Popup closes
  - Verify: Discord card updates to show linked username (e.g. `user#1234`)
  - Verify: "Verified" badge appears (green)
  - Verify: "Link Discord" button replaced by "Unlink" button (destructive red)

### Failure Cases

- [ ] **11.2.3** Deny Discord OAuth in popup
  - Verify: Popup closes, card remains "Not linked", no crash

- [ ] **11.2.4** Close popup window manually
  - Verify: Card remains "Not linked", no error toast

---

## 11.3 Link X (Twitter)

> Skip if no X account available. Requires `X_CLIENT_ID` configured.

### Steps

- [ ] **11.3.1** Click **"Link X"** button on X card
  - Verify: OAuth popup opens to X authorization page

- [ ] **11.3.2** Approve X OAuth
  - Verify: Popup closes
  - Verify: X card shows linked handle (e.g. `@username`)
  - Verify: "Verified" badge appears

---

## 11.4 Telegram Linking

> Telegram uses Login Widget, not a standard OAuth popup.

### Steps

- [ ] **11.4.1** On Telegram card, verify informational text:
  - Shows "Use Telegram Login Widget" instruction
  - Note: Record current behavior — Telegram linking may require BFF webhook setup

---

## 11.5 Apple Linking

> Apple linking is automatic via zkLogin.

### Steps

- [ ] **11.5.1** On Apple card, verify informational text:
  - Shows "Linked automatically via ZkLogin" if user logged in via Apple zkLogin
  - If user logged in via wallet: shows "Not linked" (expected)

---

## 11.6 Unlink Social Account

### Steps

- [ ] **11.6.1** On a linked platform card (e.g. Discord), click **"Unlink"**
  - Verify: Confirmation dialog or immediate unlink
  - Verify: Card reverts to "Not linked" state
  - Verify: "Link [Platform]" button reappears

- [ ] **11.6.2** Refresh page
  - Verify: Unlinked state persisted

---

## 11.7 Multiple Profiles

### Steps

- [ ] **11.7.1** Link Discord on Profile A

- [ ] **11.7.2** Navigate to Profile B, Social tab
  - Verify: Profile B shows Discord as "Not linked" (link is per-profile)

- [ ] **11.7.3** Attempt to link same Discord account on Profile B
  - Verify: Behavior recorded (may succeed or error with "already linked to another profile")
