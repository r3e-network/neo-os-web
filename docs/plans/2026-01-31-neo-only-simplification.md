# Neo-Only Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all non‑Neo chains and EVM support so only Neo N3 mainnet/testnet remain across code, config, and data.

**Architecture:** Shrink the chain layer to a single family (Neo N3) with two networks. Remove EVM adapters, RPC paths, SDK branches, and edge helpers; enforce Neo-only chain IDs in shared types and DB constraints.

**Tech Stack:** Next.js (host-app), Deno (edge functions), TypeScript, React Native (mobile wallet), Go (indexer), Supabase (DB)

---

### Task 1: Database cleanup + constraints (Neo-only data)

**Files:**
- Create: `supabase/migrations/20260131000001_remove_evm_chain_data.sql`
- Modify: `scripts/multichain_accounts_migration.sql`

**Step 1: Write the failing validation checks (SQL assertions)**

Add to the new migration (end of file) assertions that should fail if any non‑Neo chain data remains:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'multichain_accounts'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM multichain_accounts
      WHERE chain_type <> 'neo-n3'
         OR chain_id NOT IN ('neo-n3-mainnet','neo-n3-testnet')
    ) THEN
      RAISE EXCEPTION 'non-neo rows remain in multichain_accounts';
    END IF;
  END IF;
END $$;
```

**Step 2: Run migration to confirm it fails**

Run (local):

```
cd supabase
supabase db reset
```

Expected: failure because cleanup and constraints not yet applied.

**Step 3: Write minimal migration + script updates**

Add cleanup + constraints (inside `supabase/migrations/20260131000001_remove_evm_chain_data.sql`):

```sql
-- Remove non-neo chain account rows (if tables exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'multichain_accounts'
  ) THEN
    DELETE FROM multichain_accounts
    WHERE chain_type <> 'neo-n3'
       OR chain_id NOT IN ('neo-n3-mainnet','neo-n3-testnet');

    ALTER TABLE multichain_accounts
      DROP CONSTRAINT IF EXISTS multichain_accounts_chain_type_check,
      DROP CONSTRAINT IF EXISTS multichain_accounts_chain_id_check,
      ADD CONSTRAINT multichain_accounts_chain_type_check CHECK (chain_type = 'neo-n3'),
      ADD CONSTRAINT multichain_accounts_chain_id_check CHECK (chain_id IN ('neo-n3-mainnet','neo-n3-testnet'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'linked_chain_accounts'
  ) THEN
    DELETE FROM linked_chain_accounts
    WHERE chain_type <> 'neo-n3'
       OR chain_id NOT IN ('neo-n3-mainnet','neo-n3-testnet');

    ALTER TABLE linked_chain_accounts
      DROP CONSTRAINT IF EXISTS linked_chain_accounts_chain_type_check,
      DROP CONSTRAINT IF EXISTS linked_chain_accounts_chain_id_check,
      ADD CONSTRAINT linked_chain_accounts_chain_type_check CHECK (chain_type = 'neo-n3'),
      ADD CONSTRAINT linked_chain_accounts_chain_id_check CHECK (chain_id IN ('neo-n3-mainnet','neo-n3-testnet'));
  END IF;
END $$;

-- Remove miniapps that declare non-neo chains (avoids manifest/hash mismatch)
DELETE FROM miniapp_submissions
WHERE jsonb_typeof(manifest->'supported_chains') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(manifest->'supported_chains') AS c
    WHERE c NOT IN ('neo-n3-mainnet','neo-n3-testnet')
  );

DELETE FROM miniapp_internal
WHERE jsonb_typeof(manifest->'supported_chains') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(manifest->'supported_chains') AS c
    WHERE c NOT IN ('neo-n3-mainnet','neo-n3-testnet')
  );
```

Update `scripts/multichain_accounts_migration.sql` check constraint:

```sql
chain_type TEXT NOT NULL CHECK (chain_type IN ('neo-n3')),
```

**Step 4: Run migration to verify pass**

```
cd supabase
supabase db reset
```

Expected: migration passes, assertions do not throw.

**Step 5: Commit**

```
git add supabase/migrations/20260131000001_remove_evm_chain_data.sql scripts/multichain_accounts_migration.sql
git commit -m "db: enforce neo-only chain data"
```

---

### Task 2: Neo-only chain configuration + shared types

**Files:**
- Modify: `config/chains.json`
- Modify: `platform/host-app/lib/chains/types.ts`
- Modify: `platform/host-app/lib/chains/defaults.ts`
- Modify: `platform/host-app/lib/chains/index.ts`
- Modify: `platform/host-app/lib/chains/service-factory.ts`
- Delete: `platform/host-app/lib/chains/evm-service.ts`
- Delete: `platform/host-app/lib/chains/alchemy.ts`
- Modify: `platform/host-app/lib/miniapp.ts`
- Modify: `platform/edge/functions/_shared/chains.ts`
- Modify: `platform/mobile-wallet/src/lib/chains.ts`
- Modify: `packages/@neo/types/src/index.ts`
- Modify: `packages/@neo/uniapp-sdk/src/types.ts`
- Test: `platform/host-app/__tests__/functional/multichain-system.test.ts`

**Step 1: Write failing test**

Update `platform/host-app/__tests__/functional/multichain-system.test.ts` to enforce Neo-only chain IDs:

```ts
it("filters out non-neo chain IDs", () => {
  const result = normalizeSupportedChains(["neo-n3-mainnet", "ethereum-mainnet"]);
  expect(result).toEqual(["neo-n3-mainnet"]);
});
```

**Step 2: Run test to verify it fails**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/functional/multichain-system.test.ts
```

Expected: FAIL (non-neo chain IDs still accepted).

**Step 3: Implement minimal changes**

- Remove EVM chains from `config/chains.json` and `platform/edge/functions/_shared/chains.ts` (keep only neo-n3 mainnet/testnet).
- In `platform/host-app/lib/chains/types.ts`, shrink `ChainType` to `"neo-n3"`, `ChainId` to only `"neo-n3-mainnet" | "neo-n3-testnet"`, remove EVM types and helpers.
- In `platform/host-app/lib/chains/defaults.ts`, keep only `NEO_N3_MAINNET` + `NEO_N3_TESTNET` and adjust `SUPPORTED_CHAIN_CONFIGS` accordingly.
- Remove EVM exports from `platform/host-app/lib/chains/index.ts`, delete `evm-service.ts` and `alchemy.ts`, and simplify `service-factory.ts` to Neo only.
- Update `platform/host-app/lib/miniapp.ts` normalization to only accept chain IDs present in `getChainRegistry()`.
- Update `platform/mobile-wallet/src/lib/chains.ts`, `packages/@neo/types/src/index.ts`, `packages/@neo/uniapp-sdk/src/types.ts` to Neo-only `ChainType` and remove EVM-only union members.

**Step 4: Run test to verify it passes**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/functional/multichain-system.test.ts
```

Expected: PASS.

**Step 5: Commit**

```
git add config/chains.json platform/host-app/lib/chains platform/host-app/lib/miniapp.ts platform/edge/functions/_shared/chains.ts platform/mobile-wallet/src/lib/chains.ts packages/@neo/types/src/index.ts packages/@neo/uniapp-sdk/src/types.ts platform/host-app/__tests__/functional/multichain-system.test.ts
git commit -m "feat: restrict chain config to neo-n3 mainnet/testnet"
```

---

### Task 3: Remove EVM wallet providers + account generation

**Files:**
- Delete: `platform/host-app/lib/wallet/adapters/metamask.ts`
- Modify: `platform/host-app/lib/wallet/adapters/base.ts`
- Modify: `platform/host-app/lib/wallet/adapters/index.ts`
- Modify: `platform/host-app/lib/wallet/store.ts`
- Modify: `platform/host-app/lib/wallet/wallet-service.ts`
- Modify: `platform/host-app/lib/wallet/wallet-service-impl.ts`
- Delete or simplify: `platform/host-app/lib/wallet/multi-chain-store.ts`
- Modify: `platform/host-app/lib/auth0/multichain-account-browser.ts`
- Delete: `platform/host-app/lib/auth0/evm-crypto.ts`
- Modify: `platform/host-app/components/wallet/UnifiedWalletConnect.tsx`
- Modify: `platform/host-app/components/providers/SocialAccountSetupProvider.tsx`
- Modify: `platform/host-app/components/types.ts`
- Modify: `platform/host-app/lib/neohub-account/types.ts`
- Test: `platform/host-app/__tests__/functional/wallet-system.test.ts`
- Test: `platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts`

**Step 1: Write failing tests**

Update wallet provider tests to be Neo-only:

```ts
it("should not include EVM wallet providers", () => {
  const evmProviders = ["metamask"];
  evmProviders.forEach((provider) => {
    expect(provider).not.toBe("metamask");
  });
});
```

Update layout test to avoid `window.ethereum`:

```ts
(window as any).NEOLineN3 = {};
```

**Step 2: Run tests to verify failures**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/functional/wallet-system.test.ts platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts
```

Expected: FAIL (EVM provider still present).

**Step 3: Implement minimal changes**

- Remove MetaMask adapter and all EVM adapter interfaces/types from `wallet/adapters/base.ts`.
- Remove MetaMask from `wallet/store.ts` and `wallet/wallet-service-impl.ts`.
- Simplify `wallet/wallet-service.ts` wording to Neo-only.
- Remove EVM account generation from `auth0/multichain-account-browser.ts`; delete `evm-crypto.ts`.
- Update UI providers (`UnifiedWalletConnect`, `SocialAccountSetupProvider`) and `components/types.ts` to Neo-only providers.
- Update `lib/neohub-account/types.ts` to `chainType: "neo-n3"` only.
- Remove or rewrite `wallet/multi-chain-store.ts` so it no longer depends on MetaMask.

**Step 4: Run tests to verify pass**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/functional/wallet-system.test.ts platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts
```

Expected: PASS.

**Step 5: Commit**

```
git add platform/host-app/lib/wallet platform/host-app/lib/auth0 platform/host-app/components/wallet platform/host-app/components/providers platform/host-app/components/types.ts platform/host-app/lib/neohub-account/types.ts platform/host-app/__tests__/functional/wallet-system.test.ts platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts
rm -f platform/host-app/lib/wallet/adapters/metamask.ts platform/host-app/lib/auth0/evm-crypto.ts

git commit -m "feat: remove evm wallet providers and accounts"
```

---

### Task 4: Host-app RPC, stats, and validation (Neo-only)

**Files:**
- Modify: `platform/host-app/lib/chain/rpc-client.ts`
- Modify: `platform/host-app/lib/miniapp-stats/collector.ts`
- Modify: `platform/host-app/lib/security/validation.ts`
- Test: `platform/host-app/__tests__/lib/validation.test.ts`

**Step 1: Write failing test**

Update validation test to expect EVM addresses to be rejected:

```ts
it("rejects EVM addresses", () => {
  expect(isValidWalletAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
  expect(detectAddressChainType("0x1234567890abcdef1234567890abcdef12345678")).toBe(null);
});
```

**Step 2: Run test to verify it fails**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/lib/validation.test.ts
```

Expected: FAIL (EVM still accepted).

**Step 3: Implement minimal changes**

- `lib/chain/rpc-client.ts`: remove EVM endpoints, EVM RPC helpers, and make `getChainTypeFromId` return `"neo-n3"` only.
- `lib/miniapp-stats/collector.ts`: remove EVM contract event logic and `isEVMChainId` usage.
- `lib/security/validation.ts`: remove EVM patterns and helpers; accept only Neo N3.

**Step 4: Run test to verify it passes**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/lib/validation.test.ts
```

Expected: PASS.

**Step 5: Commit**

```
git add platform/host-app/lib/chain/rpc-client.ts platform/host-app/lib/miniapp-stats/collector.ts platform/host-app/lib/security/validation.ts platform/host-app/__tests__/lib/validation.test.ts

git commit -m "feat: make rpc/stats/validation neo-only"
```

---

### Task 5: Host-app API, SDK, bridge, and UI copy (Neo-only)

**Files:**
- Modify: `platform/host-app/pages/api/chains/[chainId]/balance.ts`
- Modify: `platform/host-app/pages/api/chains/[chainId]/health.ts`
- Modify: `platform/host-app/pages/api/chain/health.ts`
- Modify: `platform/host-app/pages/api/explorer/search.ts`
- Modify: `platform/host-app/pages/api/explorer/recent.ts`
- Modify: `platform/host-app/pages/api/explorer/stats.ts`
- Modify: `platform/host-app/lib/sdk/client.js`
- Modify: `platform/host-app/lib/sdk/types.ts`
- Modify: `platform/host-app/lib/sdk/types.js`
- Modify: `platform/host-app/lib/sdk/types.d.ts`
- Modify: `platform/host-app/lib/miniapp-sdk.ts`
- Modify: `platform/host-app/lib/bridge/handler.ts`
- Modify: `platform/host-app/lib/bridge/types.ts`
- Modify: `platform/host-app/components/layout/RightSidebarPanel.tsx`
- Modify: `platform/host-app/components/ui/ChainBadgeGroup.tsx`
- Modify: `platform/host-app/pages/index.tsx`
- Modify: `platform/host-app/pages/explorer.tsx`
- Modify: `platform/host-app/pages/_document.tsx`
- Modify: `platform/host-app/lib/miniapp/neo-manifest.example.json`

**Step 1: Write failing test (API validation of chainType)**

Add a quick Jest test (new file `platform/host-app/__tests__/api/chain-health.test.ts`) to assert the API rejects non‑neo chain IDs:

```ts
import handler from "@/pages/api/chain/health";
import { createMocks } from "node-mocks-http";

test("rejects non-neo chain_id", async () => {
  const { req, res } = createMocks({ method: "GET", query: { chain_id: "ethereum-mainnet" } });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(400);
});
```

**Step 2: Run test to verify it fails**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/api/chain-health.test.ts
```

Expected: FAIL (EVM still accepted).

**Step 3: Implement minimal changes**

- Remove EVM branches from API handlers (health, explorer search/recent/stats, chain balance).
- In SDK (`lib/sdk/client.js` + types), drop EVM detection, provider usage, and evm invocation branches; keep Neo-only flows.
- Simplify bridge to remove EVM-only handlers (sendTx, subscribe) or make them Neo-only if still needed.
- Update UI copy and examples to mention only Neo N3 mainnet/testnet.
- Update `neo-manifest.example.json` to only include Neo chains.

**Step 4: Run test to verify it passes**

```
pnpm test --filter=meshminiapp-host -- --runTestsByPath platform/host-app/__tests__/api/chain-health.test.ts
```

Expected: PASS.

**Step 5: Commit**

```
git add platform/host-app/pages/api platform/host-app/lib/sdk platform/host-app/lib/miniapp-sdk.ts platform/host-app/lib/bridge platform/host-app/components/layout/RightSidebarPanel.tsx platform/host-app/components/ui/ChainBadgeGroup.tsx platform/host-app/pages/index.tsx platform/host-app/pages/explorer.tsx platform/host-app/pages/_document.tsx platform/host-app/lib/miniapp/neo-manifest.example.json platform/host-app/__tests__/api/chain-health.test.ts

git commit -m "feat: remove evm from host api/sdk/bridge/ui"
```

---

### Task 6: Edge functions (Neo-only)

**Files:**
- Delete: `platform/edge/functions/_shared/evm.ts`
- Modify: `platform/edge/functions/_shared/chains.ts`
- Modify: `platform/edge/functions/app-register/index.ts`
- Modify: `platform/edge/functions/app-update-manifest/index.ts`
- Modify: `platform/edge/functions/rng-request/index.ts`
- Modify: `platform/edge/functions/pay-gas/index.ts`
- Modify: `platform/edge/functions/wallet-balance/index.ts`
- Modify: `platform/edge/functions/wallet-transactions/index.ts`
- Modify: `platform/edge/functions/explorer-search/index.ts`
- Modify: `platform/edge/functions/README.md`
- Test: `platform/edge/functions/_shared/chains_test.ts` (new)

**Step 1: Write failing Deno test**

Create `platform/edge/functions/_shared/chains_test.ts`:

```ts
import { getChains } from "./chains.ts";

Deno.test("chains config is neo-only", () => {
  const ids = getChains().map((c) => c.id);
  if (ids.some((id) => !id.startsWith("neo-n3"))) {
    throw new Error("non-neo chain present");
  }
});
```

**Step 2: Run test to verify it fails**

```
cd platform/edge
DENO_ENV=development EDGE_CORS_ORIGINS=http://localhost:3000 deno test -A functions/_shared/chains_test.ts
```

Expected: FAIL (EVM chains still present).

**Step 3: Implement minimal changes**

- Remove `evm.ts` and all EVM branches from edge functions (app-register, app-update-manifest, rng-request, pay-gas, wallet-balance, wallet-transactions, explorer-search).
- In `chains.ts`, keep only Neo N3 mainnet/testnet and remove `isEvmChain`.
- Update `pay-gas` to only accept GAS amounts (no `amount_wei`).
- Update `rng-request` to only handle Neo TEE VRF.

**Step 4: Run test to verify it passes**

```
cd platform/edge
DENO_ENV=development EDGE_CORS_ORIGINS=http://localhost:3000 deno test -A functions/_shared/chains_test.ts
```

Expected: PASS.

**Step 5: Commit**

```
git add platform/edge/functions
rm -f platform/edge/functions/_shared/evm.ts

git commit -m "feat(edge): drop evm support"
```

---

### Task 7: Mobile wallet (Neo-only)

**Files:**
- Modify: `platform/mobile-wallet/src/lib/chains.ts`
- Modify: `platform/mobile-wallet/src/lib/miniapp/sdk-types.ts`
- Modify: `platform/mobile-wallet/src/lib/miniapp/sdk-client.ts`
- Modify: `platform/mobile-wallet/src/screens/MiniAppScreen.tsx`
- Modify: `platform/mobile-wallet/src/lib/neo/rpc.ts`

**Step 1: Write failing test (if needed)**

If no existing tests cover chain type, add a small Jest test in `platform/mobile-wallet/__tests__/chains.test.ts`:

```ts
import { resolveChainType } from "@/lib/chains";

test("resolveChainType returns neo-n3", () => {
  expect(resolveChainType("neo-n3-mainnet")).toBe("neo-n3");
});
```

**Step 2: Run test to verify it fails**

```
pnpm test --filter=neo-miniapp-wallet -- --runTestsByPath platform/mobile-wallet/__tests__/chains.test.ts
```

Expected: FAIL (if EVM fallback still exists).

**Step 3: Implement minimal changes**

- Remove EVM branches from mobile SDK client and types.
- Restrict chain type to `"neo-n3"` only in `chains.ts`.
- Remove EVM error messages from `MiniAppScreen.tsx`.

**Step 4: Run test to verify it passes**

```
pnpm test --filter=neo-miniapp-wallet -- --runTestsByPath platform/mobile-wallet/__tests__/chains.test.ts
```

Expected: PASS (note: overall wallet test suite currently fails in backup tests; keep this test focused).

**Step 5: Commit**

```
git add platform/mobile-wallet/src platform/mobile-wallet/__tests__/chains.test.ts

git commit -m "feat(mobile): make miniapp sdk neo-only"
```

---

### Task 8: Services + docs/README cleanup

**Files:**
- Modify: `services/indexer/config.go`
- Modify: `README.md`
- Modify: `docs/manifest-spec.md`
- Modify: `docs/sdk-guide.md`

**Step 1: Update content (no tests)**

- Remove EVM networks from indexer config and env parsing.
- Update README to advertise Neo N3 mainnet/testnet only.
- Update manifest spec and SDK guide to remove EVM references and examples.

**Step 2: Commit**

```
git add services/indexer/config.go README.md docs/manifest-spec.md docs/sdk-guide.md

git commit -m "docs: update to neo-only support"
```

---

### Task 9: Verification

**Step 1: Host app tests**

```
pnpm test --filter=meshminiapp-host
```

**Step 2: Edge tests**

```
cd platform/edge
DENO_ENV=development EDGE_CORS_ORIGINS=http://localhost:3000 deno test -A
```

**Step 3: Mobile wallet tests (known baseline failure)**

```
pnpm test --filter=neo-miniapp-wallet
```

Expected: backup.test.ts still fails (baseline). Document if unchanged.

**Step 4: Commit final fixes (if any)**

```
git add -A
git commit -m "chore: fix neo-only cleanup issues"
```
