# Emergency Runbook

## Purpose

This runbook provides step-by-step procedures for handling emergency situations in the Neo N3 MiniApp Platform.

## Table of Contents

1. [Incident Response](#incident-response)
2. [Common Emergencies](#common-emergencies)
3. [Communication Protocols](#communication-protocols)
4. [Recovery Procedures](#recovery-procedures)

---

## Incident Response

### Severity Levels

| Level  | Name     | Response Time | Examples                                      |
| ------ | -------- | ------------- | --------------------------------------------- |
| **P0** | Critical | 15 min        | Platform down, funds at risk, security breach |
| **P1** | High     | 1 hour        | Service degraded, significant user impact     |
| **P2** | Medium   | 4 hours       | Minor feature broken, reduced performance     |
| **P3** | Low      | 24 hours      | Cosmetic issues, documentation errors         |

### Incident Command System

**Roles:**

- **Incident Commander (IC)**: Overall incident management
- **Technical Lead (TL)**: Technical investigation and resolution
- **Communications Lead (CL)**: External and stakeholder communication

**Activation:** Any P0 incident automatically activates the ICS.

---

## Common Emergencies

### 1. Smart Contract Exploit (P0)

**Symptoms:**

- Unusual fund movements
- Unexpected contract state changes
- Security alerts triggered

**Immediate Actions:**

1. **Pause Contracts** (5 minutes)

    ```bash
    # Emergency pause via PauseRegistry
    neo-go contract invokefunction -w <wallet> -r <rpc> \
      <pause_registry_hash> pauseAll <emergency_reason>

    # Or individual contract pause
    neo-go contract invokefunction -w <wallet> -r <rpc> \
      <contract_hash> setPaused true <app_id>
    ```

2. **Investigate** (15 minutes)
    - Review recent transactions
    - Check contract event logs
    - Analyze attacker behavior

3. **Containment** (30 minutes)
    - Disable vulnerable functions
    - Freeze affected accounts
    - Alert exchange if applicable

4. **Recovery** (1-4 hours)
    - Deploy patched contract
    - Restore from backup if needed
    - Communicate with users

**Post-Incident:**

- Full security audit
- Root cause analysis report
- Improve monitoring/thresholds

---

### 2. RPC Node Failure (P0)

**Symptoms:**

- All RPC calls failing
- Timeouts on contract interactions
- "Network unreachable" errors

**Immediate Actions:**

1. **Check RPC Health**

    ```bash
    # Test RPC connectivity
    curl -X POST https://<rpc_url> -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'

    # Check neo-go CLI connectivity
    neo-go cli node state -r <rpc_url>
    ```

2. **Failover to Backup RPC**

    ```bash
    # Update config to use backup RPC
    export NEO_RPC_URL=<backup_rpc_url>

    # Or restart services with new RPC
    kubectl set env deployment/platform-edge NEO_RPC_URL=<backup_url>
    ```

3. **Escalate to Infrastructure Team**
    - Check node status
    - Review metrics dashboards
    - Contact RPC providers

**Prevention:**

- Configure multiple RPC endpoints with automatic failover
- Monitor RPC health with alerts

---

### 3. Gas Bank Depletion (P0)

**Symptoms:**

- Transaction failures due to insufficient GAS
- Sponsored transactions failing
- "Insufficient GAS" errors

**Immediate Actions:**

1. **Check Gas Balance**

    ```bash
    # Query platform GAS balance
    neo-go contract testinvokefunction -r <rpc> \
      <gas_bank_contract> getBalance <platform_address>
    ```

2. **Refill Gas Bank**

    ```bash
    # Transfer GAS to GasBank
    neo-go contract invokefunction -w <wallet> -r <rpc> \
      <gas_contract> transfer <platform_address> <amount> refill

    # Or use TxProxy service
    curl -X POST https://<txproxy>/transferGas \
      -H "Authorization: Bearer <token>" \
      -d '{"to_address":"<platform>","amount":"<GAS>"}'
    ```

3. **Enable Gas Conservation**
    - Reduce non-critical operations
    - Lower gas limits if configured
    - Switch to manual approval mode

**Prevention:**

- Set up automatic low-balance alerts
- Configure automatic refill thresholds
- Maintain minimum balance buffer

---

### 4. TEE Service Failure (P1)

**Symptoms:**

- TEE services returning errors
- Timeout on attested operations
- Failed signature operations

**Immediate Actions:**

1. **Check TEE Status**

    ```bash
    # Check MarbleRun coordinator
    kubectl get pods -n marble-run

    # Check service health
    curl https://<tee_service>/health
    ```

2. **Enable Fallback Mode** (if available)
    - Switch to non-TEE operations
    - Use manual signing as temporary measure
    - Enable degraded service mode

3. **Restart TEE Services**
    ```bash
    # Restart marble services
    kubectl rollout restart deployment/<tee_service> -n marble-run
    ```

**Prevention:**

- Implement health check monitoring
- Configure automatic restart policies
- Design fallback mechanisms

---

### 5. Database Connection Issues (P1)

**Symptoms:**

- Edge functions failing with database errors
- Timeouts on Supabase queries
- Authentication failures

**Immediate Actions:**

1. **Check Database Status**

    ```bash
    # Check Supabase status
    curl https://<project>.supabase.co/rest/v1/health

    # Review database metrics
    psql -h <db_host> -U <user> -c "SELECT 1;"
    ```

2. **Enable Connection Pooling**
    - Increase pool size in config
    - Add retry logic for transient failures

3. **Escalate to Database Team**
    - Check for deadlocks
    - Review slow query logs
    - Verify connection limits

**Prevention:**

- Monitor connection pool usage
- Set up alerts for connection exhaustion
- Implement circuit breakers

---

### 6. Payment Hub Disruption (P0)

**Symptoms:**

- Payment receipts failing validation
- GAS transfers not processing
- Users unable to pay for services

**Immediate Actions:**

1. **Check Payment Hub Status**

    ```bash
    # Check if contract is paused
    neo-go contract testinvokefunction -r <rpc> <payment_hub> isPaused

    # Check recent payment events
    # (via indexer or direct RPC)
    ```

2. **Pause New Payments** (if critical)

    ```bash
    # Via PauseRegistry
    neo-go contract invokefunction -w <wallet> -r <rpc> \
      <pause_registry> pauseAll <reason>

    # Or disable PaymentHub directly
    neo-go contract invokefunction -w <wallet> -r <rpc> \
      <payment_hub> setPaused true
    ```

3. **Investigate and Fix**
    - Review recent payment attempts
    - Check for contract issues
    - Fix or deploy patched version

---

## Communication Protocols

### Internal Communication

**Channels:**

- **Critical:** Slack #incidents-critical (paged)
- **High:** Slack #incidents-high
- **Medium/Low:** Slack #incidents

**Response Times:**

- P0: Within 5 minutes
- P1: Within 30 minutes
- P2/P3: Within 2 hours

### External Communication

**Users:**

- In-app banners for platform-wide issues
- Status page updates (https://status.example.com)

**Stakeholders:**

- Email alerts for P0/P1 incidents
- Daily summary for P2 incidents

**Communication Templates:**

```
Subject: [P0] Payment Service Disruption - Action Required

Severity: Critical
Status: Investigating
Impact: Users cannot process payments
Started: <timestamp>
ETA: Unknown

Next Update: <30 minutes or sooner>
```

---

## Recovery Procedures

### Service Recovery Checklist

- [ ] Root cause identified
- [ ] Fix implemented and tested
- [ ] Services restarted
- [ ] Monitoring shows normal operation
- [ ] Sample of transactions verified
- [ ] Post-incident review scheduled

### Data Recovery

**Backup Locations:**

- Contract state snapshots: `backups/contracts/`
- Database dumps: `backups/database/`
- Configuration: `backups/config/`

**Restore Procedures:**

```bash
# Restore contract state (if needed)
neo-go contract invokefunction -w <wallet> -r <rpc> \
  <contract> restoreState <backup_data>

# Restore from database backup
psql < backup.sql
```

---

## Appendix

### Quick Reference Commands

```bash
# Emergency pause
neo-go contract invokefunction -w <wallet> -r <rpc> <pause_registry> pauseAll

# Check contract paused status
neo-go contract testinvokefunction -r <rpc> <contract> isPaused

# Get platform GAS balance
neo-go contract testinvokefunction -r <rpc> <gas_bank> getBalance

# Restart all marble services
kubectl rollout restart deployment -n marble-run

# Check RPC health
curl -X POST https://<rpc>/ -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'

# View service logs
kubectl logs -f deployment/<service> -n <namespace>
```

### Emergency Contacts

| Service             | Contact               | On-Call        |
| ------------------- | --------------------- | -------------- |
| Platform Operations | ops@example.com       | 24/7           |
| Smart Contract Team | contracts@example.com | Business hours |
| Security Team       | security@example.com  | 24/7           |
| Infrastructure      | infra@example.com     | Business hours |

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-23
**Next Review:** 2025-04-23

---

## Change Log

| Date       | Version | Changes         |
| ---------- | ------- | --------------- |
| 2025-01-23 | 1.0.0   | Initial version |
