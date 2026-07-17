# Audit Remediation Wave 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the highest-confidence security and deployment issues confirmed during the April 6, 2026 audit validation pass.

**Architecture:** This wave deliberately excludes findings that were stale, incorrect, or too ambiguous to change safely without more investigation. The work focuses on confirmed defects in the host app, Edge gateway defaults, contract transfer safety, and deployment manifests, while using the repo's existing Jest, Deno, xUnit, and Node test patterns.

**Tech Stack:** Next.js 15, Jest, Deno/Supabase Edge functions, Neo C# contracts, xUnit, Docker, Kubernetes YAML

### Task 1: Harden OAuth Popup Message Validation

**Files:**
- Modify: `platform/host-app/lib/oauth/store.ts`
- Test: `platform/host-app/__tests__/lib/oauth.store.test.ts`

**Step 1: Write the failing test**

```ts
import { __test__ } from "@/lib/oauth/store";

describe("waitForOAuthCallback", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ignores same-origin messages that do not come from the popup window", async () => {
    const popup = {} as Window;
    const promise = __test__.waitForOAuthCallback(popup, "google");

    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://app.example.com",
      source: window,
      data: {
        type: "oauth-success",
        provider: "google",
        account: { provider: "google", id: "forged", linkedAt: "2026-04-06T00:00:00.000Z" },
      },
    }));

    jest.advanceTimersByTime(120_000);
    await expect(promise).rejects.toThrow("OAuth timeout");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/lib/oauth.store.test.ts`
Expected: FAIL because the current handler accepts any same-origin `postMessage` and the helper is not exported for testing.

**Step 3: Write minimal implementation**

```ts
export const __test__ = { waitForOAuthCallback };

function waitForOAuthCallback(popup: Window, provider: OAuthProvider): Promise<OAuthAccount> {
  return new Promise((resolve, reject) => {
    // ...
    const handleMessage = (event: MessageEvent) => {
      const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
      if (!allowedOrigin) {
        cleanup();
        reject(new Error("OAuth callback origin not configured"));
        return;
      }
      if (event.origin !== allowedOrigin) return;
      if (event.source !== popup) return;
      if (event.data?.provider !== provider) return;
      // existing success / error handling
    };
    // ...
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/lib/oauth.store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/lib/oauth/store.ts platform/host-app/__tests__/lib/oauth.store.test.ts
git commit -m "fix: tighten oauth popup message validation"
```

### Task 2: Replace Regex-Only Wallet Validation With Neo Base58Check Validation

**Files:**
- Create: `platform/host-app/lib/neo-address.ts`
- Modify: `platform/host-app/lib/require-wallet-auth.ts`
- Test: `platform/host-app/__tests__/lib/neo-address.test.ts`
- Test: `platform/host-app/__tests__/lib/require-wallet-auth.test.ts`

**Step 1: Write the failing tests**

```ts
import { isValidNeoAddress } from "@/lib/neo-address";

describe("isValidNeoAddress", () => {
  it("rejects N-prefix strings with invalid checksum", () => {
    expect(isValidNeoAddress("NZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
  });

  it("accepts a valid Neo N3 address", () => {
    expect(isValidNeoAddress("Nb2oJ8Ue4MiYwJ4x24mTQjM2k7WQ4v8QkW")).toBe(true);
  });
});
```

```ts
jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { user_metadata: { address: "NZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" } } },
        error: null,
      }),
    },
  }),
}));

it("rejects authenticated users whose wallet string fails checksum validation", async () => {
  const wallet = await requireWalletAuth(req, res);
  expect(wallet).toBeNull();
  expect(res._getStatusCode()).toBe(401);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/lib/neo-address.test.ts __tests__/lib/require-wallet-auth.test.ts`
Expected: FAIL because the current code only checks `/^N[A-Za-z0-9]{33}$/`.

**Step 3: Write minimal implementation**

```ts
import { createHash } from "crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isValidNeoAddress(value: string): boolean {
  const decoded = decodeBase58(value);
  if (decoded.length !== 25) return false;
  if (decoded[0] !== 0x35) return false;
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  return Buffer.from(checksum).equals(Buffer.from(expected));
}
```

```ts
import { isValidNeoAddress } from "@/lib/neo-address";

if (typeof metadataAddress === "string") {
  const wallet = metadataAddress.trim();
  if (isValidNeoAddress(wallet)) {
    return wallet;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/lib/neo-address.test.ts __tests__/lib/require-wallet-auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/lib/neo-address.ts platform/host-app/lib/require-wallet-auth.ts platform/host-app/__tests__/lib/neo-address.test.ts platform/host-app/__tests__/lib/require-wallet-auth.test.ts
git commit -m "fix: validate neo wallet addresses with base58check"
```

### Task 3: Require Authenticated Ownership And Signed User Witnesses In Sponsor API

**Files:**
- Modify: `platform/host-app/pages/api/rpc/sponsor.ts`
- Test: `platform/host-app/__tests__/api/rpc.sponsor.test.ts`
- Keep: `platform/host-app/__tests__/api/rpc.sponsor.env.test.ts`

**Step 1: Write the failing tests**

```ts
jest.mock("@/lib/require-wallet-auth", () => ({
  requireWalletAuth: jest.fn(async () => "NactualWallet"),
}));

it("rejects sponsorship when the authenticated wallet does not match userAddress", async () => {
  const { req, res } = createMocks({
    method: "POST",
    body: { txBase64: "ignored", userAddress: "NotherWallet" },
    headers: { authorization: "Bearer token" },
  });

  await handler(req, res);
  expect(res._getStatusCode()).toBe(401);
});

it("rejects sponsorship when the transaction lacks a signed user witness", async () => {
  deserializeMock.mockImplementation(() => ({
    signers: [{ account: "user-script-hash" }],
    witnesses: [{ invocationScript: "", verificationScript: "" }],
    serialize: jest.fn(() => "deadbeef"),
    sign: jest.fn(),
    networkFee: 0n,
  }));

  await handler(req, res);
  expect(res._getStatusCode()).toBe(400);
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/api/rpc.sponsor.test.ts __tests__/api/rpc.sponsor.env.test.ts`
Expected: FAIL because the current route only checks signer membership and trusts `userAddress` from the request body.

**Step 3: Write minimal implementation**

```ts
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { standardLimit } from "@/lib/rate-limit";

function hasSignedWitness(transaction: SponsorTransaction, signerIndex: number): boolean {
  const witness = transaction.witnesses?.[signerIndex];
  return Boolean(witness?.invocationScript && String(witness.invocationScript).length > 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  // ...
  const authenticatedWallet = await requireWalletAuth(req, res);
  if (!authenticatedWallet) return;
  if (authenticatedWallet !== userAddress) {
    return apiError.unauthorized(res, "Authenticated wallet does not match requested sponsor address");
  }
  const userSignerIndex = transaction.signers.findIndex(
    (signer) => wallet.getAddressFromScriptHash(normalizeAccount(signer.account)) === userAddress,
  );
  if (userSignerIndex < 0 || !hasSignedWitness(transaction, userSignerIndex)) {
    return apiError.badRequest(res, "Transaction must include a signed user witness");
  }
  // ...
}
```

**Step 4: Run tests to verify they pass**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/api/rpc.sponsor.test.ts __tests__/api/rpc.sponsor.env.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/pages/api/rpc/sponsor.ts platform/host-app/__tests__/api/rpc.sponsor.test.ts platform/host-app/__tests__/api/rpc.sponsor.env.test.ts
git commit -m "fix: harden sponsor api request validation"
```

### Task 4: Remove Wildcard Edge CORS Fallback

**Files:**
- Modify: `platform/edge/functions/_shared/cors.ts`
- Modify: `platform/edge/README.md`
- Test: `platform/edge/functions/_shared/cors.test.ts`

**Step 1: Write the failing tests**

```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleCorsPreflight, withCors } from "./cors.ts";

Deno.test("cors: rejects preflight when EDGE_CORS_ORIGINS is unset", () => {
  Deno.env.delete("EDGE_CORS_ORIGINS");
  const res = handleCorsPreflight(new Request("http://localhost/test", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000" },
  }));
  assertEquals(res?.status, 403);
});

Deno.test("cors: echoes explicitly allowed origins", () => {
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
  const headers = withCors({}, new Request("http://localhost/test", {
    headers: { Origin: "http://localhost:3000" },
  }));
  assertEquals(headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/edge && deno test functions/_shared/cors.test.ts functions/gas-sponsor-request/index.test.ts`
Expected: FAIL because the current implementation returns `*` outside production.

**Step 3: Write minimal implementation**

```ts
export function withCors(headers: HeadersInit = {}, req?: Request): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders)) out.set(k, v);

  const allowed = parseAllowedOrigins();
  if (!allowed) {
    return out;
  }

  const origin = (req?.headers.get("Origin") ?? "").trim();
  if (origin && allowed.includes(origin)) {
    out.set("Access-Control-Allow-Origin", origin);
    out.set("Vary", "Origin");
  }
  return out;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd platform/edge && deno test functions/_shared/cors.test.ts functions/gas-sponsor-request/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/_shared/cors.ts platform/edge/functions/_shared/cors.test.ts platform/edge/README.md
git commit -m "fix: require explicit edge cors origins"
```

### Task 5: Assert Contract Transfer Results In LastSurvivor And SelfLoan

**Files:**
- Modify: `contracts/MiniAppLastSurvivor/MiniAppLastSurvivor.Settle.cs`
- Modify: `contracts/MiniAppSelfLoan/MiniAppSelfLoan.Methods.cs`
- Test: `contracts/__tests__/FinancialTransferSafetyTest.cs`

**Step 1: Write the failing test**

```csharp
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class FinancialTransferSafetyTest
    {
        [Fact]
        public void LastSurvivorWinnerPayoutMustAssertTransferResult()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppLastSurvivor", "MiniAppLastSurvivor.Settle.cs");
            Assert.Contains("ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize)", code);
        }

        [Fact]
        public void SelfLoanCollateralWithdrawalsMustAssertTransferResult()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppSelfLoan", "MiniAppSelfLoan.Methods.cs");
            Assert.Contains("ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, neoAmount)", code);
            Assert.Contains("ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral)", code);
        }
    }
}
```

**Step 2: Run test to verify it fails**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter FinancialTransferSafetyTest`
Expected: FAIL because both contracts currently call `Transfer(...)` without asserting the return value.

**Step 3: Write minimal implementation**

```csharp
ExecutionEngine.Assert(
    GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize),
    "winner payout failed");
```

```csharp
ExecutionEngine.Assert(
    NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, neoAmount),
    "collateral withdrawal transfer failed");
```

```csharp
ExecutionEngine.Assert(
    NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral),
    "loan close transfer failed");
```

**Step 4: Run tests to verify they pass**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter FinancialTransferSafetyTest`
Expected: PASS

**Step 5: Commit**

```bash
git add contracts/MiniAppLastSurvivor/MiniAppLastSurvivor.Settle.cs contracts/MiniAppSelfLoan/MiniAppSelfLoan.Methods.cs contracts/__tests__/FinancialTransferSafetyTest.cs
git commit -m "fix: assert contract payout transfer results"
```

### Task 6: Fix StreamVesting Reentrancy Exposure And RedEnvelope Sentinel Check

**Files:**
- Modify: `contracts/StreamVesting/StreamVesting.cs`
- Modify: `contracts/MiniAppRedEnvelope/MiniAppRedEnvelope.cs`
- Test: `contracts/__tests__/ContractSecurityRegressionTest.cs`

**Step 1: Write the failing tests**

```csharp
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractSecurityRegressionTest
    {
        [Fact]
        public void RedEnvelopeUsesUInt160ZeroForMissingCreator()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppRedEnvelope", "MiniAppRedEnvelope.cs");
            Assert.DoesNotContain("envelope.Creator != null", code);
            Assert.Contains("envelope.Creator != UInt160.Zero", code);
        }

        [Fact]
        public void StreamVestingClaimStreamUsesReentrancyGuard()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "StreamVesting", "StreamVesting.cs");
            Assert.Contains("EnterClaimGuard(instanceId, streamId)", code);
            Assert.Contains("ExitClaimGuard(instanceId, streamId)", code);
        }
    }
}
```

**Step 2: Run test to verify it fails**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter ContractSecurityRegressionTest`
Expected: FAIL because the current RedEnvelope check compares a struct to `null`, and `ClaimStream` has no guard before `Contract.Call(...)`.

**Step 3: Write minimal implementation**

```csharp
ExecutionEngine.Assert(envelope.Creator != UInt160.Zero, "envelope not found");
```

```csharp
private static byte[] ClaimGuardKey(string instanceId, BigInteger streamId) =>
    Helper.Concat((ByteString)"claim-guard:", (ByteString)(instanceId + ":" + streamId));

private static void EnterClaimGuard(string instanceId, BigInteger streamId)
{
    byte[] key = ClaimGuardKey(instanceId, streamId);
    ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "reentrant claim");
    Storage.Put(Storage.CurrentContext, key, 1);
}

private static void ExitClaimGuard(string instanceId, BigInteger streamId)
{
    Storage.Delete(Storage.CurrentContext, ClaimGuardKey(instanceId, streamId));
}
```

```csharp
EnterClaimGuard(instanceId, streamId);
try
{
    // current claim logic
}
finally
{
    ExitClaimGuard(instanceId, streamId);
}
```

**Step 4: Run tests to verify they pass**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter ContractSecurityRegressionTest`
Expected: PASS

**Step 5: Commit**

```bash
git add contracts/StreamVesting/StreamVesting.cs contracts/MiniAppRedEnvelope/MiniAppRedEnvelope.cs contracts/__tests__/ContractSecurityRegressionTest.cs
git commit -m "fix: add contract security regressions for stream vesting and red envelope"
```

### Task 7: Pin Deployment Inputs And Remove Placeholder Cert-Manager Fallbacks

**Files:**
- Modify: `deploy/docker/Dockerfile.service.nitro`
- Modify: `deploy/k8s/platform/cert-manager/cluster-issuer.yaml`
- Modify: `deploy/scripts/deploy_k8s.sh`
- Modify: `deploy/scripts/configure_cert_manager.sh`
- Test: `deploy/scripts/lib/deploy_hardening.test.mjs`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("nitro dockerfile uses pinned base images", () => {
  const dockerfile = fs.readFileSync("deploy/docker/Dockerfile.service.nitro", "utf8");
  assert.match(dockerfile, /FROM debian:bookworm-slim@sha256:/);
});

test("cluster issuer does not fall back to devops@miniapps.com", () => {
  const issuer = fs.readFileSync("deploy/k8s/platform/cert-manager/cluster-issuer.yaml", "utf8");
  assert.doesNotMatch(issuer, /devops@miniapps\.com/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test deploy/scripts/lib/deploy_hardening.test.mjs`
Expected: FAIL because the Dockerfile is unpinned and the ClusterIssuer still defaults to `devops@miniapps.com`.

**Step 3: Write minimal implementation**

```dockerfile
FROM golang:1.24-bookworm@sha256:<builder-digest> AS builder
FROM debian:bookworm-slim@sha256:<runtime-digest>
```

```yaml
email: ${CERT_MANAGER_EMAIL}
```

```bash
if grep -q "devops@miniapps.com" "$cert_issuer_file"; then
  log_error "cert-manager ClusterIssuer still contains the placeholder miniapps email"
fi
if ! grep -q 'CERT_MANAGER_EMAIL' "$cert_issuer_file"; then
  log_error "cert-manager ClusterIssuer must read CERT_MANAGER_EMAIL from the environment"
fi
```

**Step 4: Run tests to verify they pass**

Run: `node --test deploy/scripts/lib/deploy_hardening.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add deploy/docker/Dockerfile.service.nitro deploy/k8s/platform/cert-manager/cluster-issuer.yaml deploy/scripts/deploy_k8s.sh deploy/scripts/configure_cert_manager.sh deploy/scripts/lib/deploy_hardening.test.mjs
git commit -m "fix: harden deploy image and cert-manager defaults"
```

### Task 8: Full Verification Pass

**Files:**
- Verify only: `platform/host-app/...`
- Verify only: `platform/edge/...`
- Verify only: `contracts/...`
- Verify only: `deploy/...`

**Step 1: Run host-app targeted tests**

Run: `npm --prefix platform/host-app test -- --runInBand __tests__/lib/oauth.store.test.ts __tests__/lib/neo-address.test.ts __tests__/lib/require-wallet-auth.test.ts __tests__/api/rpc.sponsor.test.ts __tests__/api/rpc.sponsor.env.test.ts`
Expected: PASS

**Step 2: Run Edge targeted tests**

Run: `cd platform/edge && deno test functions/_shared/cors.test.ts functions/gas-sponsor-request/index.test.ts`
Expected: PASS

**Step 3: Run contract regression tests**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter FinancialTransferSafetyTest|ContractSecurityRegressionTest`
Expected: PASS

**Step 4: Run deploy hardening test**

Run: `node --test deploy/scripts/lib/deploy_hardening.test.mjs`
Expected: PASS

**Step 5: Run a concise git diff review**

Run: `git diff --stat`
Expected: Only the planned host-app, edge, contracts, deploy, and test files are modified.

**Step 6: Commit verification checkpoint**

```bash
git add docs/plans/2026-04-06-audit-remediation-wave-1.md
git commit -m "docs: add validated audit remediation wave 1 plan"
```

## Items Explicitly Excluded From This Wave

- `platform/host-app/lib/secrets.ts` plaintext-secret claim: current code stores token metadata only, not `secretValue`.
- `platform/admin-console/src/lib/admin-auth.ts` no-rate-limit claim: current code already rate limits by client IP, though it is still in-memory.
- OAuth state-verification claim: current callbacks already compare `state` with a cookie using `timingSafeEqual`.
- FlashLoan arithmetic-underflow claim: current `MIN_LOAN` is `1 GAS`, so the reported tiny-loan underflow scenario does not match the present constants.
- API-key scope tightening for legacy keys: confirmed behavior, but changing it is a compatibility break and needs a migration plan rather than a blind patch.

Plan complete and saved to `docs/plans/2026-04-06-audit-remediation-wave-1.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
