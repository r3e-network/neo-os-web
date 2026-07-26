# Deployment Sequence - Testnet
**Date:** 2026-07-25
**Target:** Neo N3 TestNet
**Deployer:** account derived from `$NEO_TESTNET_WIF` (see `.env.example`). Never paste a
WIF into this or any other file in the repository — `npm run check:repo:secret-material`
fails the build on key material, and git history cannot be un-leaked afterwards.

## Prerequisites Checklist

### Before Starting
- [ ] WIF key validated (run `validate-wif-key.mjs`)
- [ ] Testnet GAS balance >= 150 GAS
- [ ] 77-app uniqueness dry-run passed (run `aa-uniqueness-dryrun.mjs`)
- [ ] All deployment scripts peer-reviewed
- [ ] Rollback procedures documented and tested
- [ ] Monitoring tools configured
- [ ] Team notification channels ready

### Required Files
- [ ] PlatformRegistry compiled (`.nef`, `.manifest.json`)
- [ ] AppAccount compiled (`.nef`, `.manifest.json`)
- [ ] UnifiedSmartWallet address verified
- [ ] Deployment scripts in `scripts/deployment/`

## Phase 1: Infrastructure Deployment (Week 1)

### Day 1: Preparation

**Step 1.1: Validate Environment**
```bash
# Verify WIF key
node scripts/deployment/validate-wif-key.mjs

# Check contract builds
npm run build:contracts
ls -lh contracts/build/PlatformRegistry.nef
ls -lh contracts/build/AppAccount.nef

# Run uniqueness check
node scripts/deployment/aa-uniqueness-dryrun.mjs
```

**Expected Output:**
- Account address: `N...` (derived from WIF)
- GAS balance: >= 150 GAS
- Uniqueness check: 0 collisions
- Build artifacts: Present with correct checksums

**Step 1.2: Backup Current State**
```bash
# Backup current testnet Registry state
neo-express snapshot save --rpc seed1t5.neo.org:20332 \
  backup-pre-deployment-$(date +%Y%m%d).snapshot

# Export current 77-app directory
node scripts/deployment/export-registry-state.mjs > registry-backup.json
```

### Day 2: Registry Deployment/Upgrade

**Option A: Fresh Deployment** (Recommended if no active bindings)

**Step 2.1: Deploy PlatformRegistry**
```bash
# Deploy contract
neo-express contract deploy \
  contracts/build/PlatformRegistry.nef \
  contracts/build/PlatformRegistry.manifest.json \
  --wif "$NEO_TESTNET_WIF" \
  --rpc seed1t5.neo.org:20332

# Note: Save returned contract hash
REGISTRY_HASH=0x...
```

**Step 2.2: Initialize Registry**
```bash
# Set initial admin
neo-express contract invoke $REGISTRY_HASH setAdmin \
  [{"type":"Hash160","value":"<deployer-address>"}] \
  --wif "$NEO_TESTNET_WIF"

# Store AppAccount template
neo-express contract invoke $REGISTRY_HASH storeAccountArtifact \
  [{"type":"ByteArray","value":"<nef-bytes>"},{"type":"ByteArray","value":"<manifest-bytes>"}] \
  --wif ...
```

**Option B: In-Place Upgrade** (If existing Registry has active apps)

**Step 2.3: Propose Upgrade**
```bash
# Upload new contract via update
neo-express contract invoke $EXISTING_REGISTRY_HASH proposeUpdate \
  [{"type":"ByteArray","value":"<new-nef>"},{"type":"ByteArray","value":"<new-manifest>"}] \
  --wif "$NEO_TESTNET_WIF"

# Wait 24 hours (timelock)
echo "Waiting for timelock to mature: $(date -u -d '+24 hours')"
```

**Step 2.4: Execute Upgrade** (24 hours later)
```bash
# Execute timelocked upgrade
neo-express contract invoke $EXISTING_REGISTRY_HASH executeUpdate \
  --wif "$NEO_TESTNET_WIF"
```

### Day 3: Verify Deployment

**Step 3.1: Verify Registry ABI**
```bash
# Test all 49 methods are present
node scripts/deployment/verify-registry-abi.mjs $REGISTRY_HASH

# Expected: All methods accessible, no FAULT
```

**Step 3.2: Test Basic Operations**
```bash
# Test read methods
neo-express contract invoke $REGISTRY_HASH getApp \
  [{"type":"String","value":"miniapp-gasbox"}]

# Test AppAccount template storage
neo-express contract invoke $REGISTRY_HASH getAccountArtifact
```

### Day 4-5: AA Configuration

**Step 4.1: Verify UnifiedSmartWallet**
```bash
# Get current UnifiedSmartWallet address
WALLET_HASH=0x... # From neo-abstract-account deployment

# Verify reciprocal method exists
neo-express contract invoke $WALLET_HASH getPlatformRegistrar
neo-express contract invoke $REGISTRY_HASH getAbstractAccountCore
```

**Step 4.2: Propose AA Configuration (Registry Side)**
```bash
# Propose abstractAccountCore = UnifiedSmartWallet
neo-express contract invoke $REGISTRY_HASH proposeAbstractAccountCore \
  [{"type":"Hash160","value":"$WALLET_HASH"}] \
  --wif "$NEO_TESTNET_WIF"

# Note timelock maturity: 24 hours
REGISTRY_TIMELOCK_MATURE=$(date -u -d '+24 hours' '+%Y-%m-%d %H:%M:%S UTC')
echo "Registry timelock matures: $REGISTRY_TIMELOCK_MATURE"
```

**Step 4.3: Propose AA Configuration (Wallet Side)**
```bash
# Propose platformRegistrar = Registry (in neo-abstract-account repo)
cd /Users/jinghuiliao/git/r3e/neo-abstract-account

neo-express contract invoke $WALLET_HASH proposePlatformRegistrar \
  [{"type":"Hash160","value":"$REGISTRY_HASH"}] \
  --wif "$NEO_TESTNET_WIF"

# Note timelock maturity: 7 days
WALLET_TIMELOCK_MATURE=$(date -u -d '+7 days' '+%Y-%m-%d %H:%M:%S UTC')
echo "Wallet timelock matures: $WALLET_TIMELOCK_MATURE"
```

## Phase 2: Timelock Execution (Week 2)

### 7 Days Later: Execute Wallet Configuration

**Step 5.1: Execute UnifiedSmartWallet Timelock**
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account

# Execute after 7-day timelock
neo-express contract invoke $WALLET_HASH executePlatformRegistrarChange \
  --wif "$NEO_TESTNET_WIF"

# Verify configuration
neo-express contract invoke $WALLET_HASH getPlatformRegistrar
# Expected: $REGISTRY_HASH
```

### 1 Day After That: Execute Registry Configuration

**Step 5.2: Execute Registry Timelock** (24 hours after Step 4.2)
```bash
cd /Users/jinghuiliao/git/r3e/neo-miniapps-platform

# Execute after 24-hour timelock
neo-express contract invoke $REGISTRY_HASH executeAbstractAccountCoreChange \
  --wif "$NEO_TESTNET_WIF"

# Verify configuration
neo-express contract invoke $REGISTRY_HASH getAbstractAccountCore
# Expected: $WALLET_HASH
```

**Step 5.3: Verify Reciprocal Configuration**
```bash
# Both should point to each other
node scripts/deployment/verify-aa-integration.mjs
```

Expected output:
```
✅ Registry.abstractAccountCore = 0x... (UnifiedSmartWallet)
✅ UnifiedSmartWallet.platformRegistrar = 0x... (Registry)
✅ Reciprocal configuration verified
```

## Phase 3: Pilot Testing (Week 2)

### Day 10-11: 3-App Pilot

**Step 6.1: Select Pilot Apps**
```bash
PILOT_APPS=(
  "miniapp-gasbox"
  "miniapp-daily-checkin"
  "miniapp-credits"
)
```

**Step 6.2: Materialize AA Accounts**
```bash
for appId in "${PILOT_APPS[@]}"; do
  echo "Materializing AA account for $appId..."
  
  neo-express contract invoke $REGISTRY_HASH materializeAbstractAccount \
    [{"type":"String","value":"$appId"}] \
    --wif "$NEO_TESTNET_WIF"
  
  # Verify
  neo-express contract invoke $REGISTRY_HASH getAppAbstractAccount \
    [{"type":"String","value":"$appId"}]
done
```

**Step 6.3: Test Operations**
```bash
# For each pilot app, test:
# 1. Account materialization successful
# 2. Reverse index lookup works
# 3. Framework integration works

node scripts/deployment/test-pilot-apps.mjs
```

Expected results:
- All 3 apps have unique AA accounts
- Reverse index returns correct appId
- No collisions
- Framework `app.registry.getAppAbstractAccount()` works

### Day 12-13: Issue Resolution

**Step 7.1: Review Pilot Results**
```bash
# Generate pilot test report
node scripts/deployment/generate-pilot-report.mjs > pilot-results.md
```

**Step 7.2: Fix Any Issues**
- Document all issues found
- Implement fixes
- Re-test on pilot apps
- Update procedures as needed

### Day 14: Go/No-Go Decision

**Decision Criteria:**
- [ ] All 3 pilot apps materialized successfully
- [ ] No AA collisions detected
- [ ] Reverse index integrity verified
- [ ] Framework integration working
- [ ] No critical issues found
- [ ] Rollback procedure tested

**If GO:** Proceed to Phase 4
**If NO-GO:** Fix issues, repeat pilot

## Estimated Timeline

- **Week 1:** Infrastructure deployment, configuration proposals
- **Week 2 (Days 8-14):** Timelock execution, pilot testing
- **Week 3-4:** Full migration (if pilot successful)
- **Total:** ~2-3 weeks to production-ready state

## Cost Summary

| Operation | Estimated GAS |
|-----------|---------------|
| Registry deployment | 50-100 |
| AppAccount template storage | 5-10 |
| AA configuration proposals | 2-4 |
| AA configuration execution | 2-4 |
| 3-app pilot materialization | 1-3 |
| **Phase 1-3 Total** | **60-121 GAS** |

## Next Document

See `deployment-phase4-full-migration.md` for complete 77-app migration procedure.
