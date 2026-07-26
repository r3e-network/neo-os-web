# Emergency Rollback Procedures
**Date:** 2026-07-25
**Purpose:** Recovery procedures for deployment failures

## Rollback Decision Tree

### When to Rollback

**Immediate Rollback Required:**
- AA account collisions detected
- Registry configuration breaks existing apps
- Critical security vulnerability discovered
- Data loss or corruption detected
- System-wide functionality failure

**Investigate First:**
- Single app failure (isolate, don't rollback)
- Performance degradation (optimize, don't rollback)
- Minor bugs (patch forward, don't rollback)

## Scenario 1: Registry Deployment Failure

### Symptoms
- Registry deployment FAULTs
- Registry methods inaccessible
- Apps can't query Registry

### Rollback Steps
```bash
# 1. Verify old Registry still operational
neo-express contract invoke $OLD_REGISTRY_HASH getApp \
  [{"type":"String","value":"miniapp-gasbox"}]

# 2. Update framework to point to old Registry
# Edit apps/shared/constants/generated-miniapp-contracts.ts
# PLATFORM_REGISTRY_HASH = "<old-hash>"

# 3. Rebuild and redeploy affected apps
npm run build

# 4. Verify apps operational
node scripts/deployment/verify-app-functionality.mjs

# 5. Document failure, plan fix
```

**Recovery Time:** ~2 hours
**Data Loss:** None (old Registry unchanged)

## Scenario 2: AA Configuration Failure

### Symptoms
- materializeAbstractAccount() FAULTs
- Reverse index broken
- Account collisions detected

### Rollback Steps
```bash
# 1. Propose zero abstractAccountCore (disable AA)
neo-express contract invoke $REGISTRY_HASH proposeAbstractAccountCore \
  [{"type":"Hash160","value":"0x0000000000000000000000000000000000000000"}] \
  --wif $WIF

# 2. Wait 24 hours for timelock

# 3. Execute configuration reset
neo-express contract invoke $REGISTRY_HASH executeAbstractAccountCoreChange \
  --wif $WIF

# 4. Verify AA disabled
neo-express contract invoke $REGISTRY_HASH getAbstractAccountCore
# Expected: 0x0000...

# 5. Registry reverts to directory-only mode
# Existing directory entries preserved
```

**Recovery Time:** 24+ hours (timelock)
**Data Loss:** AA materializations lost, directory preserved

## Scenario 3: Pilot App Failures

### Symptoms
- Pilot apps can't access AA accounts
- Framework integration errors
- Transaction FAULTs

### Recovery Steps
```bash
# Don't rollback entire system for pilot failures

# 1. Isolate failing apps
FAILING_APPS=("app1" "app2")

# 2. Revert to old contract bindings
for app in "${FAILING_APPS[@]}"; do
  # Update manifest to use old contract
  # apps/$app/src/manifest.ts
done

# 3. Investigate root cause
node scripts/deployment/debug-pilot-failure.mjs

# 4. Fix and re-test
# Don't proceed to full migration until fixed
```

**Recovery Time:** Hours to days (investigation)
**Data Loss:** None (other apps unaffected)

## Scenario 4: Full Migration Failure

### Symptoms
- Multiple apps failing after migration
- System-wide performance issues
- Critical data inconsistencies

### Emergency Procedures
```bash
# 1. STOP - Don't materialize more apps
echo "HALT: Migration suspended"

# 2. Assess damage
node scripts/deployment/assess-migration-damage.mjs

# 3. Identify working vs broken apps
# Working apps: Keep on new system
# Broken apps: Revert to old bindings

# 4. Emergency hotfix deployment
# Deploy fixed Registry or framework
# Test on 1-2 broken apps first

# 5. Gradual re-migration
# Fix root cause
# Re-migrate apps in small batches
```

**Recovery Time:** Days (phased approach)
**Data Loss:** Depends on issue severity

## Prevention Checklist

### Before Each Phase
- [ ] Comprehensive testing on testnet
- [ ] Backup all state
- [ ] Document rollback triggers
- [ ] Practice rollback procedure
- [ ] Have team on standby

### During Deployment
- [ ] Monitor continuously
- [ ] Test after each step
- [ ] Document anomalies
- [ ] Keep communication open
- [ ] Be ready to halt

### After Issues
- [ ] Root cause analysis
- [ ] Update procedures
- [ ] Share learnings
- [ ] Prevent recurrence
