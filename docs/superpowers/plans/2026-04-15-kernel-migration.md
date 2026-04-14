# Miniapp Kernel Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 17 miniapps from individual smart contracts to the Morpheus Oracle kernel's registration + state system, remove redundant infrastructure contracts, and rewire OS edge functions to use the kernel.

**Architecture:** The Morpheus Oracle kernel (already deployed on testnet at `0x4b882e94ed766807c4fd728768f972e13008ad52`) provides `RegisterMiniApp`, `PutMiniAppState`/`GetMiniAppState`, and `SubmitMiniAppRequest`/`FulfillRequest`. Simple miniapps register as an appId and store state in the kernel's namespaced storage. Business logic runs in edge functions. Complex miniapps (9) keep custom contracts but register with the kernel for discovery.

**Tech Stack:** Neo N3 smart contracts (C#), Deno edge functions, React frontend, neon-js RPC

---

## File Structure

```
contracts/                          # AFTER migration
  MiniAppBase/                      # Keep — shared base class
  MiniApp.DevPack/                  # Keep — dev tooling
  MiniAppLastSurvivor/              # Keep — custom contract (atomic GAS)
  MiniAppSelfLoan/                  # Keep — custom contract (collateral)
  MiniAppFlashLoan/                 # Keep — custom contract (flash loan)
  MiniAppGASBox/                    # Keep — custom contract (gacha)
  MiniAppFogPlay/                   # Keep — custom contract (bet/payout)
  MiniAppRedEnvelope/               # Keep — custom contract (GAS split)
  MiniAppCompoundCapsule/           # Keep — custom contract (time-lock)
  MiniAppHeritageTrust/             # Keep — custom contract (trust)
  MiniAppUnbreakableVault/          # Keep — custom contract (bounty)
  __tests__/                        # Keep — contract tests

  # REMOVE all of the following (17 miniapps migrate to kernel):
  # MiniAppDailyCheckin, MiniAppNeoPay, MiniAppBurnLeague,
  # MiniAppCouncilGovernance, MiniAppGovMerc, MiniAppQuadraticFunding,
  # MiniAppBreakupContract, MiniAppGasSponsor, MiniAppMilestoneEscrow,
  # MiniAppOnChainTarot, MiniAppDevTipping, MiniAppTimeCapsule,
  # MiniAppGraveyard, MiniAppMemorialShrine, MiniAppSoulboundCertificate,
  # MiniAppEventTicketPass, MiniAppTrustAnchor

  # REMOVE infrastructure (replaced by kernel):
  # AppRegistry, AutomationAnchor, PauseRegistry, Governance

platform/edge/functions/_shared/
  os-service.ts                     # Modify — rewire to kernel PutMiniAppState
  kernel-rpc.ts                     # Create — helpers for kernel contract calls

platform/host-app/lib/
  rpc-helpers.ts                    # Modify — read state from kernel for all apps

apps/shared/services/os/
  StorageProxy.ts                   # Already works — edge functions handle routing
```

---

### Task 1: Remove 17 miniapp contracts and 4 infrastructure contracts

**Files:**
- Delete: `contracts/MiniAppDailyCheckin/` (18 files)
- Delete: `contracts/MiniAppNeoPay/` (1 file)
- Delete: `contracts/MiniAppBurnLeague/` (11 files)
- Delete: `contracts/MiniAppCouncilGovernance/` (5 files)
- Delete: `contracts/MiniAppGovMerc/` (11 files)
- Delete: `contracts/MiniAppQuadraticFunding/` (4 files)
- Delete: `contracts/MiniAppBreakupContract/` (4 files)
- Delete: `contracts/MiniAppGasSponsor/` (6 files)
- Delete: `contracts/MiniAppMilestoneEscrow/` (4 files)
- Delete: `contracts/MiniAppOnChainTarot/` (7 files)
- Delete: `contracts/MiniAppDevTipping/` (1 file)
- Delete: `contracts/MiniAppTimeCapsule/` (10 files)
- Delete: `contracts/MiniAppGraveyard/` (8 files)
- Delete: `contracts/MiniAppMemorialShrine/` (4 files)
- Delete: `contracts/MiniAppSoulboundCertificate/` (4 files)
- Delete: `contracts/MiniAppEventTicketPass/` (4 files)
- Delete: `contracts/MiniAppTrustAnchor/` (1 file)
- Delete: `contracts/AppRegistry/` (1 file)
- Delete: `contracts/AutomationAnchor/` (1 file)
- Delete: `contracts/PauseRegistry/` (1 file)
- Delete: `contracts/Governance/` (1 file)
- Modify: `contracts/__tests__/ContractBuildWarningsTest.cs` — remove stale refs

- [ ] **Step 1: Delete all 21 contract directories**

```bash
cd ~/git/neo-miniapps-platform
git rm -r \
  contracts/MiniAppDailyCheckin contracts/MiniAppNeoPay contracts/MiniAppBurnLeague \
  contracts/MiniAppCouncilGovernance contracts/MiniAppGovMerc contracts/MiniAppQuadraticFunding \
  contracts/MiniAppBreakupContract contracts/MiniAppGasSponsor contracts/MiniAppMilestoneEscrow \
  contracts/MiniAppOnChainTarot contracts/MiniAppDevTipping contracts/MiniAppTimeCapsule \
  contracts/MiniAppGraveyard contracts/MiniAppMemorialShrine contracts/MiniAppSoulboundCertificate \
  contracts/MiniAppEventTicketPass contracts/MiniAppTrustAnchor \
  contracts/AppRegistry contracts/AutomationAnchor contracts/PauseRegistry contracts/Governance
```

- [ ] **Step 2: Update test file to remove references to deleted contracts**

Remove any test methods that reference deleted contract paths.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All 639 tests pass (contract tests may need adjustment)

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove 21 contracts migrated to Morpheus kernel

17 miniapp contracts replaced by kernel registration + edge functions.
4 infrastructure contracts replaced by kernel built-in capabilities.
Remaining: 9 custom contracts + MiniAppBase + DevPack + tests."
```

---

### Task 2: Create kernel RPC helper for edge functions

**Files:**
- Create: `platform/edge/functions/_shared/kernel-rpc.ts`

- [ ] **Step 1: Write kernel RPC helper**

```typescript
// platform/edge/functions/_shared/kernel-rpc.ts
import { getEnv } from "./env.ts";

const KERNEL_HASH = getEnv("CONTRACT_MORPHEUS_ORACLE_HASH") ?? "";
const RPC_URL = getEnv("NEO_RPC_URL") ?? "https://testnet1.neo.coz.io:443";

export function getKernelHash(): string {
  return KERNEL_HASH;
}

export function buildKernelStateRead(appId: string, stateKey: string) {
  return {
    contract: KERNEL_HASH,
    operation: "GetMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stateKey },
    ],
  };
}

export function buildKernelStateWrite(appId: string, stateKey: string, value: string) {
  return {
    contract: KERNEL_HASH,
    operation: "PutMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stateKey },
      { type: "ByteArray", value: value },
    ],
  };
}

export function buildKernelStateBatchWrite(appId: string, keys: string[], values: string[]) {
  return {
    contract: KERNEL_HASH,
    operation: "PutMiniAppStateBatch",
    args: [
      { type: "String", value: appId },
      { type: "Array", value: keys.map(k => ({ type: "ByteArray", value: k })) },
      { type: "Array", value: values.map(v => ({ type: "ByteArray", value: v })) },
    ],
  };
}

export function buildKernelStateDelete(appId: string, stateKey: string) {
  return {
    contract: KERNEL_HASH,
    operation: "DeleteMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stateKey },
    ],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/edge/functions/_shared/kernel-rpc.ts
git commit -m "feat: add kernel RPC helper for edge functions"
```

---

### Task 3: Rewire OS edge functions to use kernel instead of deleted contracts

**Files:**
- Modify: `platform/edge/functions/_shared/os-service.ts`
- Modify: `platform/edge/functions/os-storage-set/index.ts`
- Modify: `platform/edge/functions/os-storage-get/index.ts`
- Modify: `platform/edge/functions/os-storage-delete/index.ts`
- Modify: `platform/edge/functions/os-storage-list/index.ts`

- [ ] **Step 1: Update os-storage-set to use kernel PutMiniAppState**

Replace `CONTRACT_STORAGE_SERVICE_HASH` with kernel hash and `Set` method with `PutMiniAppState`.

- [ ] **Step 2: Update os-storage-get to use kernel GetMiniAppState**

- [ ] **Step 3: Update os-storage-delete to use kernel DeleteMiniAppState**

- [ ] **Step 4: Update remaining OS edge functions similarly**

Each OS edge function that called a deleted service contract now calls the equivalent kernel method.

- [ ] **Step 5: Commit**

```bash
git add platform/edge/functions/
git commit -m "refactor: rewire OS edge functions to Morpheus kernel"
```

---

### Task 4: Update host-app LiveContractView to read kernel state

**Files:**
- Modify: `platform/host-app/lib/rpc-helpers.ts`
- Modify: `platform/host-app/components/MiniAppPlayfield.tsx`

- [ ] **Step 1: Add kernel contract hash to rpc-helpers**

Add the Morpheus Oracle kernel hash and a `readKernelState(appId, key)` helper.

- [ ] **Step 2: Update fetchAppStats in MiniAppPlayfield**

For the 17 kernel-registered miniapps, read state via `GetMiniAppState` instead of calling individual contract methods.

For the 9 custom-contract miniapps, keep the existing direct contract reads.

- [ ] **Step 3: Run tests**

```bash
npm run test:host-app
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: read kernel state for 17 migrated miniapps in UI"
```

---

### Task 5: Register all miniapps in the kernel on testnet

**Files:**
- Create: `deploy/scripts/register_miniapps_in_kernel.js`

- [ ] **Step 1: Write registration script**

Script that calls `RegisterMiniApp` on the kernel for each of the 17 migrated miniapps, using the provided admin WIF.

- [ ] **Step 2: Run registration on testnet**

```bash
NEO_TESTNET_WIF=L4cNA7HKn5CRtPeKJCSedTFpej8Yq2E5s1xvhxoHKBjcFcvqG9HZ \
  node deploy/scripts/register_miniapps_in_kernel.js
```

- [ ] **Step 3: Verify registration**

Read `GetMiniAppCount()` and `GetMiniApp(appId)` for each registered app.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add kernel registration script, register 17 miniapps on testnet"
```

---

### Task 6: Final cleanup and validation

- [ ] **Step 1: Remove stale deploy config references**

Clean `deploy/config/testnet.json` and `testnet_contracts.json` of references to deleted contracts.

- [ ] **Step 2: Run full test suite**

```bash
npm test
npm run test:integration
```

- [ ] **Step 3: Run testnet smoke test**

```bash
NEO_TESTNET_WIF=L4cNA7HKn5CRtPeKJCSedTFpej8Yq2E5s1xvhxoHKBjcFcvqG9HZ \
  node deploy/scripts/smoke_business_workflows.js
```

- [ ] **Step 4: Final commit and push**

```bash
git push origin master
```
