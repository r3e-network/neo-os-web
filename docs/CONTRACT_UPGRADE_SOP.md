# Smart Contract Upgrade SOP

## Overview

This document outlines the standard operating procedure (SOP) for upgrading Neo N3 smart contracts on the MiniApp Platform.

## Table of Contents

1. [Pre-Upgrade Checklist](#pre-upgrade-checklist)
2. [Upgrade Procedure](#upgrade-procedure)
3. [Rollback Procedure](#rollback-procedure)
4. [Post-Upgrade Verification](#post-upgrade-verification)
5. [Emergency Contacts](#emergency-contacts)

---

## Pre-Upgrade Checklist

### 1. Code Review & Testing

- [ ] Code changes reviewed by at least 2 developers
- [ ] All tests passing in development environment
- [ ] Security audit completed (if applicable)
- [ ] Gas optimization analysis performed
- [ ] Breaking changes documented

### 2. Backup & Verification

- [ ] Current contract state backed up
- [ ] Deployment configuration backed up
- [ ] Test results documented
- [ ] Rollback plan approved

### 3. Approval & Communication

- [ ] Upgrade approved by governance (if required)
- [ ] Stakeholders notified of planned upgrade
- [ ] Maintenance window scheduled
- [ ] Downtime communication prepared

### 4. Environment Preparation

- [ ] Target network RPC nodes verified accessible
- [ ] Deployment wallet funded with sufficient GAS
- [ ] Admin keys secured and accessible
- [ ] Monitoring tools configured

---

## Upgrade Procedure

### Phase 1: Preparation (T-1 hour)

1. **Verify Environment**

    ```bash
    # Check RPC connectivity
    neo-go cli node state

    # Verify wallet balance
    neo-go wallet nep17 balance <wallet_file>
    ```

2. **Load Deployment Tools**

    ```bash
    cd /home/neo/git/service_layer/contracts
    source deploy/config/<network>.env
    ```

3. **Compile Contracts**

    ```bash
    # Build all contracts
    ./build.sh

    # Verify build outputs
    ls -la build/*.nef build/*.manifest.json
    ```

### Phase 2: Pre-Deployment Verification (T-15 minutes)

1. **Verify Contract Addresses**

    ```bash
    # Get current contract state
    neo-go contract testinvokefunction <contract_hash> getDeployInfo
    ```

2. **Record Current State**

    ```bash
    # Save current contract state
    neo-go contract getstate -r <contract_hash> > backup_state_<timestamp>.json
    ```

3. **Final Approval**
    - [ ] All team members ready
    - [ ] Monitoring dashboard active
    - [ ] Emergency response team on standby

### Phase 3: Deployment (Execute in Maintenance Window)

#### Option A: In-Place Update (Preferred)

1. **Deploy Update Transaction**

    ```bash
    # Use the Update method for existing contracts
    neo-go contract update -i build/<ContractName>.nef \
      -m build/<ContractName>.manifest.json \
      -r <rpc_url> \
      -w <wallet_file> \
      --hash <existing_contract_hash>
    ```

2. **Verify Deployment**

    ```bash
    # Check transaction status
    neo-go rpc tx <tx_hash> -v

    # Verify contract updated
    neo-go contract getstate -r <contract_hash>
    ```

#### Option B: New Deployment (Only if Update Not Possible)

1. **Deploy New Contract**

    ```bash
    neo-go contract deploy -i build/<ContractName>.nef \
      -m build/<ContractName>.manifest.json \
      -r <rpc_url> \
      -w <wallet_file>
    ```

2. **Update Dependencies**
    - Update ServiceLayerGateway references
    - Update MiniApp references (if applicable)
    - Update platform configuration

### Phase 4: Post-Deployment Validation

1. **Verify Contract State**

    ```bash
    # Check admin
    neo-go contract testinvokefunction <contract_hash> Admin

    # Check version/properties
    neo-go contract getstate -r <contract_hash>
    ```

2. **Test Contract Operations**
    - Run integration tests
    - Verify all public methods work
    - Check event emission

3. **Monitor for Issues**
    - Watch RPC logs for errors
    - Monitor gas usage
    - Track transaction failure rates

---

## Rollback Procedure

### When to Rollback

- Critical bugs discovered post-deployment
- Security vulnerabilities identified
- Unexpected state changes
- Insufficient testing coverage
- Stakeholder request for reversal

### Rollback Steps

#### Option A: Revert Update (If Within TimeLock Window)

```bash
# If admin change is still pending, cancel it
neo-go contract invokefunction -w <wallet_file> -r <rpc_url> \
  <contract_hash> cancelAdminChange

# Otherwise, propose old admin and execute after timelock
neo-go contract invokefunction -w <wallet_file> -r <rpc_url> \
  <contract_hash> proposeAdmin <old_admin_hash>
```

#### Option B: Deploy Previous Version

```bash
# Use the backup NEF and manifest files
neo-go contract update -i backups/<ContractName>_backup.nef \
  -m backups/<ContractName>_backup.manifest.json \
  -r <rpc_url> \
  -w <wallet_file> \
  --hash <contract_hash>
```

#### Option C: Emergency Migration

If rollback is not possible, deploy a new contract with the previous code:

1. Deploy new contract with previous version
2. Migrate state if necessary
3. Update all references to point to new contract
4. Deprecate old contract

---

## Post-Upgrade Verification

### Immediate Checks (Within 1 hour)

- [ ] Contract responds to all methods
- [ ] Events being emitted correctly
- [ ] No unexpected gas usage
- [ ] Integration tests passing

### Short-Term Monitoring (24 hours)

- [ ] Monitor transaction success rate
- [ ] Track gas consumption patterns
- [ ] Check for any reverted transactions
- [ ] Review platform error logs

### Long-Term Validation (7 days)

- [ ] Full regression test suite passing
- [ ] Security audit verification
- [ ] Performance benchmarks met
- [ ] User acceptance testing complete

---

## Emergency Contacts

| Role            | Name | Contact | Availability         |
| --------------- | ---- | ------- | -------------------- |
| Lead Developer  | -    | -       | 24/7 during upgrades |
| Security Lead   | -    | -       | 24/7 during upgrades |
| DevOps Engineer | -    | -       | Business hours       |
| Platform Owner  | -    | -       | Business hours       |

### Escalation Procedure

1. **Minor Issues** - Contact Lead Developer
2. **Critical Issues** - Contact all on-call team
3. **Security Incidents** - Contact Security Lead immediately

---

## Appendix

### A. Common Update Scenarios

| Scenario                    | Procedure                  | Time Estimate |
| --------------------------- | -------------------------- | ------------- |
| Bug fix (non-breaking)      | In-place update            | 30 min        |
| Feature addition (breaking) | New deployment + migration | 2-4 hours     |
| Security patch (critical)   | Emergency update           | 15 min        |
| Governance change           | Follow TimeLock procedure  | 24-48 hours   |

### B. Useful Commands

```bash
# Get contract hash
neo-go contract invokefunction <hash> getContractHash

# Check contract storage
neo-go contract getstate -r <hash> --key <key>

# Test invoke
neo-go contract testinvokefunction -r <rpc_url> <hash> <method> <args>

# Get NEF manifest
neo-go contract manifest -r <rpc_url> <hash>

# Calculate deployment gas
neo-go contract testdeploy -i build/<Contract>.nef -m build/<Contract>.manifest.json
```

### C. Configuration Files

- Deployment configs: `deploy/config/`
- Network settings: `config/`
- Contract manifests: `contracts/build/`

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-23
**Next Review:** 2025-04-23
