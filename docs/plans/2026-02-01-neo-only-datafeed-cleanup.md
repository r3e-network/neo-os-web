# Neo-Only Datafeed Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep Chainlink-based price feeds for Neo while removing Arbitrum/EVM wording and enforcing Neo N3 mainnet/testnet-only semantics across config, code, tests, and docs.

**Architecture:** Treat Chainlink as an internal price source behind a generic `ARBITRUM_RPC` configuration and Neo network names. The datafeed service remains optional and guarded by env configuration, while user-facing docs and tests refer only to Neo N3 mainnet/testnet. Infrastructure chain config rejects non-Neo types.

**Tech Stack:** Go services, Next.js host app, YAML/JSON configs, k8s manifests, Docker Compose.

### Task 1: Confirm Chainlink RPC config (service + marble entrypoint)

**Files:**
- Modify: `services/datafeed/marble/service.go`
- Modify: `services/datafeed/marble/chainlink.go`
- Modify: `cmd/marble/main.go`
- Modify: `test/contract/datafeeds_integration_test.go`

**Step 1: Update contract datafeed tests to use ARBITRUM_RPC (failing compile)**

```go
rpc := strings.TrimSpace(os.Getenv("ARBITRUM_RPC"))
if rpc == "" {
    t.Skip("ARBITRUM_RPC not set")
}
svc, err := neofeeds.New(neofeeds.Config{ /* ... */ ArbitrumRPC: rpc })
```

**Step 2: Run tests to confirm failure before implementation**

Run: `go test ./test/contract -run NeoFeedsPriceFetching -v`
Expected: FAIL (ArbitrumRPC not yet wired)

**Step 3: Wire service config and env**

```go
// services/datafeed/marble/service.go
ArbitrumRPC string // RPC URL for Chainlink feeds
// strict mode validation + initialization use ArbitrumRPC
```

```go
// cmd/marble/main.go
arbitrumRPC := strings.TrimSpace(os.Getenv("ARBITRUM_RPC"))
// pass ArbitrumRPC: arbitrumRPC
```

**Step 4: Normalize Chainlink client defaults**

```go
// services/datafeed/marble/chainlink.go
// remove DefaultArbitrumRPC constant
if rpcURL == "" { return nil, fmt.Errorf("chainlink rpc url required") }
// update error messages to "chainlink rpc"
```

**Step 5: Re-run targeted tests**

Run: `go test ./test/contract -run NeoFeedsPriceFetching -v`
Expected: PASS (or SKIP if ARBITRUM_RPC unset)

**Step 6: Commit**

```bash
git add services/datafeed/marble/service.go services/datafeed/marble/chainlink.go cmd/marble/main.go test/contract/datafeeds_integration_test.go
git commit -m "refactor(datafeed): rename chainlink rpc config"
```

### Task 2: Neo-only network naming for infrastructure datafeed

**Files:**
- Modify: `infrastructure/datafeed/client.go`
- Modify: `infrastructure/datafeed/feeds.go`
- Modify: `infrastructure/datafeed/service.go`
- Modify: `infrastructure/datafeed/datafeed_test.go`

**Step 1: Update tests to use neo-n3 networks + ARBITRUM_RPC (failing compile)**

```go
rpc := strings.TrimSpace(os.Getenv("ARBITRUM_RPC"))
if rpc == "" { t.Skip("ARBITRUM_RPC not set") }
client, err := datafeed.NewClient(rpc, "neo-n3-mainnet")
```

**Step 2: Run tests to confirm failure before implementation**

Run: `go test ./infrastructure/datafeed -v`
Expected: FAIL (tests reference new names before code updates)

**Step 3: Update feeds + client naming**

```go
// feeds.go
// rename ArbitrumMainnetFeeds -> ChainlinkMainnetFeeds
// rename ArbitrumSepoliaFeeds -> ChainlinkTestnetFeeds
// accept "neo-n3-mainnet" / "neo-n3-testnet" in GetFeedsForNetwork
```

```go
// client.go
// remove DefaultArbitrumRPC constant
// require rpcURL when creating client
```

**Step 4: Update comments to remove Arbitrum**

```go
// Service provides price feed data from Chainlink.
```

**Step 5: Re-run tests**

Run: `go test ./infrastructure/datafeed -v`
Expected: PASS (or SKIP if ARBITRUM_RPC unset)

**Step 6: Commit**

```bash
git add infrastructure/datafeed/feeds.go infrastructure/datafeed/client.go infrastructure/datafeed/service.go infrastructure/datafeed/datafeed_test.go
git commit -m "refactor(datafeed): neo-only network naming"
```

### Task 3: Update env/config manifests for ARBITRUM_RPC

**Files:**
- Modify: `.env.example`
- Modify: `docker/docker-compose.yaml`
- Modify: `docker/docker-compose.simulation.yaml`
- Modify: `docker/Dockerfile.service`
- Modify: `k8s/base/configmap.yaml`
- Modify: `k8s/base/services-deployment.yaml`
- Modify: `scripts/apply_k8s_config_from_env.sh`

**Step 1: Confirm ARBITRUM_RPC is wired in env/config manifests**

- Keep Arbitrum wording for the Chainlink RPC source.
- Default value may be empty (optional) depending on environment.

**Step 2: Commit**

```bash
git add .env.example docker/docker-compose.yaml docker/docker-compose.simulation.yaml docker/Dockerfile.service k8s/base/configmap.yaml k8s/base/services-deployment.yaml scripts/apply_k8s_config_from_env.sh
git commit -m "chore(config): rename chainlink rpc env"
```

### Task 4: Host app UI + tests (Neo-only wording)

**Files:**
- Modify: `platform/host-app/pages/stats.tsx`
- Modify: `platform/host-app/lib/i18n/locales/en/host.json`
- Modify: `platform/host-app/lib/i18n/locales/zh/host.json`
- Modify: `platform/host-app/__tests__/functional/multichain-system.test.ts`
- Modify: `platform/host-app/__tests__/api/chain-health.test.ts`
- Modify: `platform/host-app/__tests__/lib/sdk-client.test.ts`
- Modify: `platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts`

**Step 1: Update tests to use generic unsupported chain/provider names (failing compile if types change)**

```ts
expect(isChainSupported(app, "unsupported-chain" as any)).toBe(false);
```

**Step 2: Update stats defaults + i18n strings**

- Chain distribution default to Neo N3 only.
- Replace "Arbitrum"/"Ethereum/BSC/Polygon" wording with Neo-only language.

**Step 3: Run host-app tests**

Run: `pnpm -C platform/host-app test -- multichain-system.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add platform/host-app/pages/stats.tsx platform/host-app/lib/i18n/locales/en/host.json platform/host-app/lib/i18n/locales/zh/host.json platform/host-app/__tests__/functional/multichain-system.test.ts platform/host-app/__tests__/api/chain-health.test.ts platform/host-app/__tests__/lib/sdk-client.test.ts platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts
git commit -m "chore(host): neo-only wording and tests"
```

### Task 5: Remove EVM chain type in infra config

**Files:**
- Modify: `infrastructure/chains/config.go`

**Step 1: Remove ChainTypeEVM and validation**

```go
const (
    ChainTypeNeoN3 ChainType = "neo-n3"
)
// Validate: only neo-n3
```

**Step 2: Run infra tests**

Run: `go test ./infrastructure/chains -v`
Expected: PASS

**Step 3: Commit**

```bash
git add infrastructure/chains/config.go
git commit -m "refactor(chains): enforce neo-n3 only"
```

### Task 6: Misc docs/comments cleanup

**Files:**
- Modify: `services/datafeed/README.md`
- Modify: `services/datafeed/marble/README.md`
- Modify: `services/datafeed/neofeeds.example.yaml`
- Modify: `services/simulation/marble/contracts.go`
- Modify: `services/simulation/marble/contracts_test.go`
- Modify: `scripts/multichain_accounts_migration.sql`

**Step 1: Replace Arbitrum/EVM wording with Neo-only or generic Chainlink language**

**Step 2: Commit**

```bash
git add services/datafeed/README.md services/datafeed/marble/README.md services/datafeed/neofeeds.example.yaml services/simulation/marble/contracts.go services/simulation/marble/contracts_test.go scripts/multichain_accounts_migration.sql
git commit -m "docs: neo-only datafeed wording"
```

### Task 7: Full verification

**Step 1: Run Go test suite**

Run: `go test ./...`
Expected: PASS

**Step 2: Run Edge tests (if touched)**

Run: `cd platform/edge && DENO_ENV=development EDGE_CORS_ORIGINS=http://localhost:3000 deno test -A`
Expected: PASS

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: finalize neo-only cleanup" || true
```
