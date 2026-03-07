# 01 — Auth Flows

## 1.1 Wallet Connect Login

**Why manual:** Requires browser wallet extension interaction (popup approval).

### Steps

- [ ] **1.1.1** Open `http://localhost:3000/login`
  - Verify: Page shows "Sign in" title and "Choose your preferred authentication method"
  - Verify: Three buttons visible — "Continue with Google", "Connect Wallet", "Use Passkey"

- [ ] **1.1.2** Click **"Connect Wallet"**
  - Verify: Wallet selection modal appears (shows installed wallets: Sui Wallet, Suiet, etc.)

- [ ] **1.1.3** Select your wallet (e.g. "Sui Wallet")
  - Verify: Wallet extension popup opens requesting connection approval

- [ ] **1.1.4** Approve connection in wallet popup
  - Verify: Login page now shows truncated address (e.g. `0x1a2b...3c4d`) with dropdown chevron
  - Verify: Loading spinner appears briefly (BFF authentication in progress)

- [ ] **1.1.5** Wait for redirect
  - Verify: Automatically redirected to Dashboard (`/`)
  - Verify: Dashboard shows "Dashboard" title and "Welcome to ROSMAR CRM"
  - Verify: Sidebar visible with nav items (Dashboard, Profiles, Organizations, Deals, etc.)
  - Verify: Topbar shows workspace name

- [ ] **1.1.6** Open DevTools > Application > Cookies
  - Verify: `access_token` cookie exists (httpOnly, path `/`)
  - Verify: `refresh_token` cookie exists (httpOnly, path `/`)

### Failure Cases

- [ ] **1.1.7** Reject wallet connection
  - Go to `/login`, click "Connect Wallet", select wallet, **reject** in popup
  - Verify: No redirect, stays on login page, no error crash

- [ ] **1.1.8** Connect with wrong network
  - Switch wallet to mainnet, attempt login
  - Verify: Error message displayed (auth challenge fails)

---

## 1.2 zkLogin (Google) Login

**Why manual:** Requires Google OAuth redirect and real Google account.

> Skip if `ENOKI_API_KEY` not configured — button shows "(Coming soon)" and is disabled.

### Steps

- [ ] **1.2.1** Open `http://localhost:3000/login`
  - Verify: "Continue with Google" button is enabled (not showing "Coming soon")

- [ ] **1.2.2** Click **"Continue with Google"**
  - Verify: Redirected to Google OAuth consent screen

- [ ] **1.2.3** Select Google account and approve
  - Verify: Redirected back to `http://localhost:3000/login` with OAuth params
  - Verify: Auto-authentication proceeds (loading state)

- [ ] **1.2.4** Wait for redirect
  - Verify: Redirected to Dashboard
  - Verify: Session cookies set

---

## 1.3 Passkey Login

**Why manual:** Requires WebAuthn hardware/biometric prompt (Touch ID, Face ID, security key).

> Prerequisite: Must have registered a passkey first (see test 02, workspace settings).

### Steps

- [ ] **1.3.1** Open `http://localhost:3000/login`

- [ ] **1.3.2** Click **"Use Passkey"**
  - Verify: Fingerprint icon changes to loading spinner
  - Verify: Browser/OS biometric prompt appears (Touch ID / Windows Hello / security key)

- [ ] **1.3.3** Authenticate with biometric
  - Verify: Redirect to Dashboard
  - Verify: Session cookies set

### Failure Cases

- [ ] **1.3.4** Cancel biometric prompt
  - Verify: Error message "Passkey authentication failed" (or similar)
  - Verify: Button re-enables, no crash

- [ ] **1.3.5** No passkey registered
  - Fresh browser with no registered passkey
  - Click "Use Passkey"
  - Verify: Appropriate error (no credentials available)

---

## 1.4 Session Refresh

**Why manual:** Need to wait for token expiry or manually expire cookie.

### Steps

- [ ] **1.4.1** Login successfully (any method)

- [ ] **1.4.2** In DevTools > Application > Cookies, delete `access_token` cookie (keep `refresh_token`)

- [ ] **1.4.3** Navigate to any page (e.g. click "Profiles" in sidebar)
  - Verify: Page loads correctly (BFF auto-refreshes token via refresh_token cookie)
  - Verify: New `access_token` cookie appears in cookies

- [ ] **1.4.4** Delete **both** `access_token` and `refresh_token` cookies

- [ ] **1.4.5** Navigate to any page
  - Verify: Redirected to `/login` (no valid session)

---

## 1.5 Logout

### Steps

- [ ] **1.5.1** Login successfully

- [ ] **1.5.2** Click user avatar/menu in topbar (top-right)
  - Verify: Dropdown shows "Settings" and "Logout"

- [ ] **1.5.3** Click **"Logout"**
  - Verify: Redirected to `/login`
  - Verify: `access_token` and `refresh_token` cookies cleared
  - Verify: Wallet disconnected (Connect Wallet button shows, not address)

- [ ] **1.5.4** Press browser Back button
  - Verify: Does NOT return to dashboard (stays on login or redirects back to login)

- [ ] **1.5.5** Manually navigate to `http://localhost:3000/`
  - Verify: Redirected to `/login`

---

## 1.6 Auth Guard (Unauthenticated Access)

### Steps

- [ ] **1.6.1** Clear all cookies and localStorage, navigate to `http://localhost:3000/`
  - Verify: Redirected to `/login`

- [ ] **1.6.2** Try direct URL access to protected pages:
  - `/profiles` -> redirects to `/login`
  - `/deals` -> redirects to `/login`
  - `/settings/workspace` -> redirects to `/login`
  - Verify: None of the above show dashboard content
