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

## 9.3 Encrypt & Store Note

### Steps

- [ ] **9.3.1** With valid profile ID entered, look at "Encrypt & Store Note" card (Lock icon)
  - Verify: Fields — Key (placeholder `e.g., api-key, private-note`), Content textarea (placeholder `Sensitive content to encrypt...`)
  - Verify: Button "Encrypt & Save to Walrus"

- [ ] **9.3.2** Fill in:
  - Key: `test-api-key`
  - Content: `sk-1234567890abcdef`
  - Click **"Encrypt & Save to Walrus"**
  - Verify: Loading state while encrypting + uploading
  - Verify: Success feedback (secret appears in "Saved Secrets" list)

- [ ] **9.3.3** Verify in "Saved Secrets" card:
  - Key name `test-api-key` visible
  - Blob ID badge shown
  - Secret is NOT shown in plain text (encrypted)

- [ ] **9.3.4** Store a second secret:
  - Key: `private-note`
  - Content: `This is a confidential note for testing`
  - Verify: Both secrets listed

---

## 9.4 Retrieve Secret

### Steps

- [ ] **9.4.1** Click on `test-api-key` in the secrets list (if clickable)
  - Verify: Decrypted content shown (`sk-1234567890abcdef`)
  - Or verify via API:
  ```
  curl http://localhost:3001/api/vault/secrets/{profileId}/test-api-key \
    -H "Cookie: access_token=..."
  ```
  - Verify: Returns encrypted data (client decrypts)

---

## 9.5 Update Secret

### Steps

- [ ] **9.5.1** Update the `test-api-key` secret:
  - Change content to `sk-updated-key-value`
  - Save
  - Verify: Secret updated (retrieve shows new value)

---

## 9.6 Delete Secret

### Steps

- [ ] **9.6.1** Delete `test-api-key`:
  - Via UI or API:
  ```
  curl -X DELETE http://localhost:3001/api/vault/secrets/{profileId}/test-api-key \
    -H "Cookie: access_token=..."
  ```
  - Verify: Secret removed from list
  - Verify: Only `private-note` remains

---

## 9.7 Files Tab

### Steps

- [ ] **9.7.1** Click **"Files"** tab
  - Verify: FileUploader component visible
  - Verify: "Uploaded Files" card visible
  - Verify: Empty state "No encrypted files yet"

- [ ] **9.7.2** Upload a test file (if FileUploader is functional):
  - Select a small text file or image
  - Verify: Upload progress/feedback
  - Verify: File appears in "Uploaded Files" list

- [ ] **9.7.3** If FileUploader is a stub:
  - Note: `FileUploader may still be a stub component`
  - Verify: No crash when interacting
  - Record current state for future implementation

---

## 9.8 Encryption Verification

### Steps

- [ ] **9.8.1** Check database directly (if access available):
  ```sql
  SELECT key, "encryptedData" FROM "VaultSecret" WHERE "profileId" = '{id}';
  ```
  - Verify: `encryptedData` is NOT plain text (base64 or binary blob reference)
  - Verify: Content is encrypted before storage
