# Comprehensive Platform Audit - Part 2: AA Account Integration Analysis
**Date:** 2026-07-25

## 3. Abstract Account (AA) Integration Status

### 3.1 UnifiedSmartWallet Architecture (neo-abstract-account)

**Core Contract:** UnifiedSmartWallet (partials structure)
- `UnifiedSmartWallet.State.cs` - Storage and state management
- `UnifiedSmartWallet.Internal.cs` - Internal helpers
- `UnifiedSmartWallet.Paymaster.cs` - Gas sponsorship
- `UnifiedSmartWallet.MarketEscrow.cs` - Marketplace escrow functionality
- Verifiers: `Web3AuthVerifier.cs`, `TEEVerifier.cs`
- Recovery: `MorpheusSocialRecoveryVerifier` (6 partials)

**Key Features:**
- Session key support
- Social recovery mechanism
- Multi-verifier plugin system
- Gas sponsorship (paymaster)
- Market escrow integration

### 3.2 PlatformRegistry ↔ AA Integration

**Integration Points:**

1. **Registration Flow:**
   ```
   PlatformRegistry.registerApp(appId, engineId, appAdmin, descriptor)
   ↓ (when abstractAccountCore configured)
   UnifiedSmartWallet.registerStablePlatformAccount(appId, appAdmin, escapeTimelock)
   ↓
   Creates deterministic account identity
   ```

2. **Account Derivation:**
   - **Formula:** `accountId = f(Registry.scriptHash, appId, escapeTimelock)`
   - **Stability:** Admin rotation does NOT change accountId
   - **Uniqueness:** Domain-separated by executing script hash
   - **Backup Owner:** App admin stored as backup, can rotate

3. **Governance Safeguards:**
   - Registry: 24-hour timelock on `abstractAccountCore` pointer
   - UnifiedSmartWallet: 7-day timelock on `platformRegistrar` pointer
   - Reciprocal verification: each side verifies the other points back

**Current Status:**
- ✅ Architecture designed and documented
- ✅ Source code complete in both repositories
- ⚠️ **NOT YET DEPLOYED:** Testnet Registry lacks AA integration ABI
- ⚠️ **0/77 apps** have materialized AA accounts
- ⚠️ Testnet deployment is "live-artifact-drift"

### 3.3 Directory vs Treasury Separation

**Critical Design Decision:** Separate app identity from app treasury

**App Identity (Required):**
- Created via `UnifiedSmartWallet.registerStablePlatformAccount()`
- Zero deployment cost (account computation is deterministic)
- Used for: authentication, authorization, engine binding
- Stored in: Registry directory (`0x11` prefix)

**App Treasury (Optional):**
- Created via `PlatformRegistry.mintAccount()` 
- Cost: ~10 GAS (system fee + platform fee)
- Used for: isolated NEP-17 asset custody
- Stored in: Optional AppAccount deployment

**Framework Surface:**
- `app.registry.getAppAbstractAccount(appId)` → `{core, accountId, materialized}`
- `app.registry.getPredictedAbstractAccount(appId)` → deterministic prediction
- `app.registry.materializeAbstractAccount(appId)` → idempotent materialization

### 3.4 Migration Path for Existing Apps

**Current State:** 77 active directory rows, 0 shared-AA materializations

**Migration Options:**

**Option A: Automatic (Default for new registrations)**
- When `abstractAccountCore` is configured
- `registerApp()` automatically materializes AA account
- Zero marginal cost for apps

**Option B: Retroactive (For existing 77 apps)**
- Call `materializeAbstractAccount(appId)` per app
- Requires: app-admin or platform-admin witness
- Idempotent: safe to call multiple times
- Can be batched in deployment script

**Option C: Treasury Isolation (Optional upgrade)**
- Apps needing isolated custody call `mintAccount(appId)`
- ~10 GAS cost per app
- Total for 77 apps: ~771 GAS system fee + 23 GAS network fee

### 3.5 Gaps and Risks

**Gap 1: Deployment Coordination**
- Registry and UnifiedSmartWallet must be configured reciprocally
- Requires coordinated timelock execution
- **Risk:** One-sided configuration would break integration

**Gap 2: Uniqueness Verification**
- 77-app dry-run needed to verify no collisions
- Reverse index (`0x22` prefix) must be validated
- **Risk:** Undiscovered collision would break authentication

**Gap 3: Migration Testing**
- No end-to-end test of 77-app batch materialization
- Recovery from partial failures not documented
- **Risk:** Production migration could fail partway

**Gap 4: Framework Readiness**
- Framework surfaces implemented but not battle-tested
- Error handling for AA failures needs validation
- **Risk:** Client-side errors during AA operations

## 4. Verification Requirements Before Deployment

### 4.1 Pre-Deployment Checklist

- [ ] Reciprocal configuration verified (Registry ↔ UnifiedSmartWallet)
- [ ] 77-app uniqueness dry-run passes
- [ ] Reverse index integrity verified
- [ ] Timelock execution sequence documented
- [ ] Rollback procedure defined
- [ ] Framework error handling tested
- [ ] Cost estimation validated with testnet
- [ ] Migration script peer-reviewed

### 4.2 Recommended Testing Sequence

1. **Testnet Isolated Test:** Deploy fresh Registry + UnifiedSmartWallet
2. **10-App Pilot:** Materialize 10 diverse apps, verify all operations
3. **Full Dry-Run:** Simulate all 77 apps, capture gas costs
4. **Stress Test:** Concurrent registrations, verify no race conditions
5. **Failure Recovery:** Test partial failure scenarios
6. **Production Deployment:** Only after all tests pass
