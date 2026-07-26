# Final Deployment Checklist - Ready to Execute

## Status: READY FOR DEPLOYMENT ✅

All preparation work complete. Deployment can proceed immediately.

## Pre-Deployment Verification ✅

- ✅ Registry source complete (75 ABI methods)
- ✅ Registry compiled successfully (0 errors)
- ✅ NEF artifact ready: `contracts/build/PlatformRegistry.nef` (14K)
- ✅ Manifest ready: `contracts/build/PlatformRegistry.manifest.json` (15K)
- ✅ Deployment scripts ready
- ✅ Rollback procedures documented
- ⬜ Deployer signer validated: run `node scripts/deployment/validate-wif-key.mjs`, which
  reads `$NEO_TESTNET_WIF`. The key must not be written into this file: the previously
  quoted WIF is compromised (committed in `3423e507`, audit finding C-6) and needs
  rotation.

## Immediate Actions Required

### Step 1: Validate WIF Key Balance (5 min)
```bash
node scripts/deployment/validate-wif-key.mjs
```
**Required:** Testnet GAS balance >= 150 GAS

### Step 2: Run Uniqueness Dry-Run (10 min)
```bash
node scripts/deployment/aa-uniqueness-dryrun.mjs
```
**Expected:** 0 collisions across 77 apps

### Step 3: Deploy Registry to Testnet (30 min)
Follow: `docs/deployment/deployment-sequence-phase1-3.md`

**Commands:**
```bash
# Deploy Registry
neo-express contract deploy \
  contracts/build/PlatformRegistry.nef \
  contracts/build/PlatformRegistry.manifest.json \
  --wif "$NEO_TESTNET_WIF" \
  --rpc seed1t5.neo.org:20332

# Save returned contract hash
REGISTRY_HASH=0x...
```

### Step 4: Configure AA Integration (8 days)
- Day 1: Propose Registry.abstractAccountCore = UnifiedSmartWallet
- Day 1: Propose UnifiedSmartWallet.platformRegistrar = Registry
- Day 8: Execute UnifiedSmartWallet timelock (7 days)
- Day 9: Execute Registry timelock (24 hours after Day 1)

### Step 5: Pilot Testing (3 days)
- Materialize 3 pilot apps
- Verify AA accounts work
- Test framework integration
- Document issues

## Estimated Timeline

- **Week 1:** Registry deployment + AA configuration proposals
- **Week 2:** Timelock execution + pilot testing
- **Week 3-4:** Full 77-app materialization
- **Total:** 2-3 weeks to production-ready

## Cost Estimate

| Operation | GAS Cost |
|-----------|----------|
| Registry deployment | 50-100 |
| AA configuration | 4-8 |
| Pilot testing (3 apps) | 1-3 |
| Full materialization (77 apps) | 15-30 |
| **Phase 1-3 Total** | **70-141 GAS** |

## Risk Mitigation

- ✅ Rollback procedures documented
- ✅ Pilot testing before full migration
- ✅ Monitoring scripts ready
- ✅ Emergency procedures defined

## Success Criteria

### Phase 1 Success (Week 1):
- [ ] Registry deployed with 75-method ABI
- [ ] AA configuration proposals submitted
- [ ] No deployment errors

### Phase 2 Success (Week 2):
- [ ] Both timelocks executed successfully
- [ ] Reciprocal configuration verified
- [ ] 3 pilot apps materialized

### Phase 3 Success (Week 3-4):
- [ ] All 77 apps have AA accounts
- [ ] Zero collisions detected
- [ ] Framework integration working
- [ ] Ready for mainnet

## Next Command to Execute

```bash
# Start with WIF key validation
node scripts/deployment/validate-wif-key.mjs
```

This will verify the deployment account has sufficient GAS balance before proceeding.
