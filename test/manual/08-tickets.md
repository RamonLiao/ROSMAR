# 08 — Tickets

> Prerequisite: Login complete (01).

## 8.1 Create Ticket

### Steps

- [ ] **8.1.1** Navigate to **Tickets** via sidebar
  - Verify: Page shows tickets list/table
  - Verify: "Create Ticket" button (or equivalent) visible

- [ ] **8.1.2** Click create ticket button
  - Verify: Form/dialog opens with fields: title, status, priority, assignee, SLA deadline

- [ ] **8.1.3** Fill in:
  - Title: `[TEST] Fix login redirect bug`
  - Status: `open`
  - Priority: `high`
  - SLA Deadline: (set to tomorrow's date/time)
  - Click submit
  - Verify: Ticket appears in list
  - Verify: Status badge "open"
  - Verify: Priority badge "high"

- [ ] **8.1.4** Create second ticket:
  - Title: `[TEST] Add export feature`
  - Status: `open`
  - Priority: `low`
  - Verify: Appears in list

---

## 8.2 View Ticket Detail

### Steps

- [ ] **8.2.1** Click on `[TEST] Fix login redirect bug`
  - Verify: Navigates to `/tickets/[id]`
  - Verify: Shows all ticket fields (title, status, priority, assignee, SLA, created)

---

## 8.3 Update Ticket Status

### Steps

- [ ] **8.3.1** Update ticket status to `in_progress`:
  - Via UI or API:
  ```
  curl -X PATCH http://localhost:3001/api/tickets/{id} \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"status": "in_progress"}'
  ```
  - Verify: Status badge changes to "in_progress"

- [ ] **8.3.2** Update to `waiting`
  - Verify: Badge updates

- [ ] **8.3.3** Update to `resolved`
  - Verify: Badge updates

- [ ] **8.3.4** Update to `closed`
  - Verify: Badge updates

---

## 8.4 Update Ticket Priority

### Steps

- [ ] **8.4.1** Change priority from `high` to `critical`
  - Verify: Priority badge updates

- [ ] **8.4.2** Change to `medium`
  - Verify: Badge updates

---

## 8.5 SLA Deadline Display

### Steps

- [ ] **8.5.1** Create ticket with SLA deadline 1 hour from now
  - Verify: SLA displays with timezone-aware formatting
  - Verify: Near-deadline tickets show urgency indicator (if implemented)

- [ ] **8.5.2** Create ticket with SLA deadline in the past
  - Verify: Shows overdue state (if implemented)

---

## 8.6 Delete Ticket

### Steps

- [ ] **8.6.1** Delete a test ticket:
  - Via UI delete button or API:
  ```
  curl -X DELETE http://localhost:3001/api/tickets/{id} \
    -H "Cookie: access_token=..."
  ```
  - Verify: Ticket removed from list
