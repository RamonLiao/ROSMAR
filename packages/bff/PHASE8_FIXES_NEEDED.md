# Phase 8 Build Errors - Fixes Needed

## @mysten/sui SDK 2.4.0 API Issues

### 1. SuiClient Import Error
**File:** `src/blockchain/sui.client.ts`
**Error:** Module '"@mysten/sui/client"' has no exported member 'SuiClient'
**Fix:** Check @mysten/sui 2.4.0 docs for correct client import (might be `SuiHTTPTransport` or similar)

### 2. JwtService Payload Type
**Files:** `src/auth/auth.service.ts` (lines 53, 83, 113, 143)
**Error:** JwtService.sign() overload mismatch
**Fix:** Cast UserPayload to `Record<string, any>` or serialize to plain object

### 3. JwtModule Factory Return Type
**File:** `src/auth/auth.module.ts` line 17
**Error:** Factory return type doesn't match JwtModuleOptions
**Fix:** Ensure return type explicitly matches or add type assertion

## Quick Fixes

```typescript
// sui.client.ts - Replace SuiClient with correct import
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
// OR check actual exports from SDK

// auth.service.ts - Fix JwtService.sign calls
const accessToken = this.jwtService.sign({ ...user } as any);
// OR properly serialize UserPayload

// auth.module.ts - Add explicit return type
useFactory: (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET'),
  signOptions: { expiresIn: '15m' },
}),
```

## Verification
Run: `pnpm run build` in packages/bff to verify fixes
