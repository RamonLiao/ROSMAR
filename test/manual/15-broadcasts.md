# 15 — Broadcasts

> Prerequisite: Login complete (01). Workspace created (02). At least 1 segment exists (06) for targeting context.

## 15.1 Broadcast List Page

### Steps

- [ ] **15.1.1** Navigate to **Broadcasts** (`/broadcasts`) via sidebar
  - Verify: Page shows broadcast DataTable with columns — Title, Channels, Status, Sent, Deliveries, Actions
  - Verify: "New Broadcast" button visible (top-right)
  - Verify: Empty state if no broadcasts exist

---

## 15.2 Create Broadcast

### Steps

- [ ] **15.2.1** Click **"New Broadcast"**
  - Verify: API creates a draft → redirects to `/broadcasts/:id`
  - Verify: BroadcastEditor page loads with empty form

- [ ] **15.2.2** Verify editor form fields:
  - Title input (editable)
  - Content textarea (editable)
  - ChannelPicker — 3 checkboxes: Telegram, Discord, X (Twitter)
  - "Save Draft" / "Update Draft" button
  - "Send Now" button
  - Schedule toggle + datetime picker

---

## 15.3 Edit Draft

### Steps

- [ ] **15.3.1** Fill in:
  - Title: `[TEST] Weekly Update`
  - Content: `Hello community! Here's what happened this week...`
  - Channels: check **Telegram** and **Discord**
  - Click **"Update Draft"**
  - Verify: Success feedback, data persisted

- [ ] **15.3.2** Navigate back to `/broadcasts`
  - Verify: `[TEST] Weekly Update` in list
  - Verify: Status badge = **draft** (grey/default)
  - Verify: Channels column shows Telegram + Discord badges

- [ ] **15.3.3** Click "View" to re-enter the broadcast
  - Verify: Saved title, content, and channels are pre-filled

---

## 15.4 Send Broadcast Immediately

### Steps

- [ ] **15.4.1** On editor page, ensure at least 1 channel selected
  - Click **"Send Now"**
  - Verify: Confirmation or loading state
  - Verify: Redirected to broadcast list

- [ ] **15.4.2** Verify in list:
  - Status badge = **sent** (green) or **sending** (blue)
  - "Sent" column shows timestamp
  - "Deliveries" column shows count

---

## 15.5 Schedule Broadcast

### Steps

- [ ] **15.5.1** Create a new broadcast (repeat 15.2)
  - Fill title: `[TEST] Scheduled Announcement`
  - Content: `Coming soon...`
  - Select channel: **X (Twitter)**

- [ ] **15.5.2** Toggle **Schedule** on
  - Verify: Datetime picker appears
  - Pick a future date/time
  - Click **"Confirm Schedule"**
  - Verify: Success feedback

- [ ] **15.5.3** Check list page:
  - Status badge = **scheduled** (blue/yellow)
  - Sent column shows scheduled datetime

---

## 15.6 Broadcast Analytics

### Steps

- [ ] **15.6.1** Click "View" on a **sent** broadcast
  - Verify: Analytics section visible (only for sent broadcasts)
  - Verify: Per-channel progress bars showing delivered/total count and percentage

- [ ] **15.6.2** For a **draft** broadcast:
  - Verify: Analytics section NOT shown

---

## 15.7 Non-Draft Restrictions

### Steps

- [ ] **15.7.1** Open a **sent** broadcast in editor
  - Verify: Title and Content inputs are **disabled** (read-only)
  - Verify: "Send Now" and "Update Draft" buttons hidden or disabled
