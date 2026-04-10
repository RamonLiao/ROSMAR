# 19 — GDPR (Data Export & Deletion)

> Prerequisite: Login complete (01). At least 1 profile exists (04).

## 19.1 Export Profile Data

### Steps

- [ ] **19.1.1** Export a profile's data:
  ```
  curl http://localhost:3001/api/profiles/{profileId}/export \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns JSON dump of all profile data
  - Verify: Includes profile fields, wallets, tags, related organizations, deal associations

- [ ] **19.1.2** Export for a non-existent profile ID
  - Verify: Returns 404 (not 500)

---

## 19.2 Initiate GDPR Deletion

### Steps

- [ ] **19.2.1** Create a test profile specifically for deletion (via 04 steps)
  - Record the profile ID

- [ ] **19.2.2** Initiate deletion:
  ```
  curl -X DELETE http://localhost:3001/api/profiles/{profileId}/gdpr \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"legalBasis": "user_request", "requestedBy": "test@example.com", "workspaceId": "{wsId}"}'
  ```
  - Verify: Returns `{ message: "Deletion scheduled", profileId: "..." }`

- [ ] **19.2.3** Check deletion status:
  ```
  curl http://localhost:3001/api/profiles/{profileId}/gdpr/status \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns status (e.g. `pending`, `processing`, `completed`)

---

## 19.3 Cancel Deletion

### Steps

- [ ] **19.3.1** Cancel a pending deletion:
  ```
  curl -X POST http://localhost:3001/api/profiles/{profileId}/gdpr/cancel \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns `{ message: "Deletion cancelled", profileId: "..." }`

- [ ] **19.3.2** Check status again:
  - Verify: Status is no longer `pending`
  - Verify: Profile still accessible via `GET /profiles/{id}`

---

## 19.4 Rate Limiting

### Steps

- [ ] **19.4.1** Send 4 deletion requests in quick succession for the same profile:
  - Verify: First 3 succeed (or return appropriate status)
  - Verify: 4th request is rate-limited (429 or similar error)
  - Note: Rate limit is 3 requests per 10 minutes

---

## 19.5 Deletion Completion

### Steps

- [ ] **19.5.1** Initiate deletion on a test profile and wait for async job to complete:
  - Check status periodically until `completed`
  - Verify: `GET /profiles/{id}` returns 404
  - Verify: Related data (wallets, vault secrets, deal associations) also removed
