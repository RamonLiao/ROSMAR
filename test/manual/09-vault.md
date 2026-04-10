# 09 — Vault

> Prerequisite: Login complete (01). At least 1 profile exists (04).

## 9.1 Vault Page

### Steps

- [ ] **9.1.1** Navigate to **Vault** via sidebar
  - Verify: Page shows "Vault" title and "Encrypted notes and files with client-side encryption"
  - Verify: Two tabs visible — "Notes" (default), "Files"
  - Verify: Profile ID input field (placeholder "Enter profile ID to manage secrets")

---

## 9.2 Enter Profile ID

### Steps

- [ ] **9.2.1** Enter a valid profile ID from test 04 into the "Profile ID" input
  - Verify: "Saved Secrets" card updates (may show "No encrypted secrets yet" or loading spinner)

- [ ] **9.2.2** Enter an invalid/non-existent profile ID
  - Verify: Graceful handling (empty list or error message, no crash)

---

## 9.3 Policy Selection (Seal)

### Steps

- [ ] **9.3.1** Before encrypting, verify **PolicySelector** component visible
  - Verify: Radio group — "Workspace Members" (default, ruleType 0) and "Custom"

- [ ] **9.3.2** Select **"Workspace Members"** (default)
  - Verify: No additional config needed — all workspace members can decrypt

- [ ] **9.3.3** Select **"Custom"** → Rule Type dropdown appears
  - Verify: Options — "Specific Addresses" (ruleType 1), "Role-Based" (ruleType 2)

- [ ] **9.3.4** Choose **"Specific Addresses"**
  - Verify: Text input for comma-separated wallet addresses (e.g. `0xaddr1, 0xaddr2`)
  - Verify: Optional "Policy Expiry" datetime-local input

- [ ] **9.3.5** Choose **"Role-Based"**
  - Verify: Dropdown for minimum role — Viewer (0), Member (1), Admin (2), Owner (3)
  - Verify: Optional "Policy Expiry" datetime-local input

- [ ] **9.3.6** Create a custom policy (Specific Addresses with 1 address)
  - Verify: `POST /vault/policies` called → returns `{ policyId, digest }`
  - Verify: Policy created on-chain (or dry-run mock)

---

## 9.4 Encrypt & Store Note

### Steps

- [ ] **9.4.1** With valid profile ID and policy selected, look at "Encrypt & Store Note" card (Lock icon)
  - Verify: Fields — Key (placeholder `e.g., api-key, private-note`), Content textarea (placeholder `Sensitive content to encrypt...`)
  - Verify: Button "Encrypt & Save to Walrus"

- [ ] **9.4.2** Fill in:
  - Key: `test-api-key`
  - Content: `sk-1234567890abcdef`
  - Click **"Encrypt & Save to Walrus"**
  - Verify: Loading state while encrypting + uploading
  - Verify: Success feedback (secret appears in "Saved Secrets" list)

- [ ] **9.4.3** Verify in "Saved Secrets" card:
  - Key name `test-api-key` visible
  - Blob ID badge shown
  - Secret is NOT shown in plain text (encrypted)

- [ ] **9.4.4** Store a second secret:
  - Key: `private-note`
  - Content: `This is a confidential note for testing`
  - Verify: Both secrets listed

---

## 9.5 Retrieve Secret

### Steps

- [ ] **9.5.1** Click on `test-api-key` in the secrets list (if clickable)
  - Verify: Decrypted content shown (`sk-1234567890abcdef`)
  - Or verify via API:
  ```
  curl http://localhost:3001/api/vault/secrets/{profileId}/test-api-key \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns encrypted data (client decrypts)

---

## 9.6 Update Secret

### Steps

- [ ] **9.6.1** Update the `test-api-key` secret:
  - Change content to `sk-updated-key-value`
  - Save
  - Verify: Secret updated (retrieve shows new value)

---

## 9.7 Delete Secret

### Steps

- [ ] **9.7.1** Delete `test-api-key`:
  - Via UI or API:
  ```
  curl -X DELETE http://localhost:3001/api/vault/secrets/{profileId}/test-api-key \
    -H "Cookie: access_token=..."
  ```
  - Verify: Secret removed from list
  - Verify: Only `private-note` remains

---

## 9.8 Files Tab

### Steps

- [ ] **9.8.1** Click **"Files"** tab
  - Verify: FileUploader component visible with PolicySelector
  - Verify: "Uploaded Files" card visible
  - Verify: Empty state "No encrypted files yet"

- [ ] **9.8.2** Select a Seal policy (same PolicySelector as Notes tab)
  - Verify: PolicySelector works identically to 9.3

- [ ] **9.8.3** Upload a test file:
  - Select a small text file or image
  - Verify: Upload progress/feedback
  - Verify: File appears in "Uploaded Files" list with encryption badge

---

## 9.9 Encryption Verification

### Steps

- [ ] **9.9.1** Check database directly (if access available):
  ```sql
  SELECT key, "encryptedData" FROM "VaultSecret" WHERE "profileId" = '{id}';
  ```
  - Verify: `encryptedData` is NOT plain text (base64 or binary blob reference)
  - Verify: Content is encrypted before storage
