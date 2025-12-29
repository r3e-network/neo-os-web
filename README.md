# Neo Service Layer

A service layer for Neo N3 that combines a user-facing **Gateway** (Supabase Edge) with enclave workloads (MarbleRun + EGo) for signing and confidential computation.

For the canonical, up-to-date architecture overview see `docs/ARCHITECTURE.md`.

For the target MiniApp platform blueprint/spec, see `docs/neo-miniapp-platform-blueprint.md` and `docs/neo-miniapp-platform-full.md`.
For the reviewed English architectural blueprint, see `docs/neo-miniapp-platform-architectural-blueprint.md`.

## Scope (Current)

**Product services** (only these are in scope right now):

- `services/datafeed` (`service_id`: `neofeeds`)
- `services/automation` (`service_id`: `neoflow`)
- `services/confcompute` (`service_id`: `neocompute`)
- `services/vrf` (`service_id`: `neovrf`)
- `services/conforacle` (`service_id`: `neooracle`)
- `services/txproxy` (`service_id`: `txproxy`)
- `services/requests` (`service_id`: `neorequests`)
- `services/gasbank` (`service_id`: `neogasbank`, optional)
- `services/simulation` (`service_id`: `neosimulation`, dev-only)

Randomness is provided via `services/vrf` (NeoVRF) inside the enclave.

**Infrastructure marbles** (shared capabilities):

- `infrastructure/globalsigner` (`service_id`: `globalsigner`)
- `infrastructure/accountpool` (`service_id`: `neoaccounts`)

## Runtime Boundary (TEE vs Non‑TEE)

- **Outside TEE (default)**: user workflows (Supabase Auth), wallet bindings, secrets UX + API.
- **Inside TEE**: service execution that needs confidentiality/integrity, enclave-held keys, and signing (GlobalSigner + service workloads).

Secrets are **not** a separate service: they are managed by the gateway and stored in Supabase encrypted with `SECRETS_MASTER_KEY`.

## Repository Layout

- `cmd/`: binaries (`cmd/marble`, deploy tooling, bundle verification helpers)
- `infrastructure/`: shared building blocks (runtime, middleware, chain I/O, secrets, storage helpers, account pool, global signer)
- `services/`: product services only (see “Scope”)
- `contracts/`: Neo N3 MiniApp platform contracts
- `platform/`: platform layer (Supabase Edge functions, JS SDK, Next.js host app)
- Export targets (intentionally empty in git; generated via scripts):
  - `platform/host-app/public/miniapps/` + `platform/host-app/public/sdk/` (run `make export-miniapps`)
  - `supabase/functions/` (run `make export-supabase-functions`)
  - `supabase/migrations/` (run `make export-supabase-migrations`)
- `docker/`, `k8s/`, `manifests/`, `deploy/`: deployment and operations

For enforced responsibility boundaries, see `docs/LAYERING.md`.

## Quick Start (Local Simulation)

Prereqs: Go, Docker, Node.js.

```bash
make docker-up
```

Run a single service locally (outside MarbleRun) for debugging:

```bash
SERVICE_TYPE=neocompute go run ./cmd/marble
# Or run VRF:
# SERVICE_TYPE=neovrf go run ./cmd/marble
```

Supabase Edge functions are the intended public gateway. See `platform/edge/README.md` for setup and required env vars.

For the full local k3s stack (Supabase + Edge + MarbleRun), run:

```bash
./scripts/bootstrap_k3s_dev.sh --env-file .env --edge-env-file .env.local
```

Or see `docs/LOCAL_DEV.md` for detailed steps.

## Key Environment Variables

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_KEY`: Supabase service role key (used by Go services and tooling).
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (used by Supabase Edge functions).
- `SECRETS_MASTER_KEY`: encryption master key for secrets APIs (`platform/edge/functions/secrets-*`) and secret injection into TEE services.
- `NEO_RPC_URL` / `NEO_RPC_URLS`, `NEO_NETWORK_MAGIC`: Neo RPC configuration (services).
- `CONTRACT_PAYMENTHUB_HASH`, `CONTRACT_GOVERNANCE_HASH`, `CONTRACT_PRICEFEED_HASH`, `CONTRACT_RANDOMNESSLOG_HASH`, `CONTRACT_APPREGISTRY_HASH`, `CONTRACT_AUTOMATIONANCHOR_HASH`, `CONTRACT_SERVICEGATEWAY_HASH`: MiniApp platform contract hashes.
- `CONTRACT_MINIAPP_CONSUMER_HASH` (optional): MiniApp callback test contract hash for workflow scripts.
- `TXPROXY_ALLOWLIST`: tx-proxy allowlist JSON (contract+method policy).
- `GASBANK_URL` (optional): GasBank service URL for fee deduction.
- `GASBANK_DEPOSIT_ADDRESS` (optional): deposit address for GasBank verification.
- `NEOACCOUNTS_SERVICE_URL` (optional): account pool service URL.

See `.env.example` for a full list.

## Docs

- `docs/ARCHITECTURE.md`: current end-to-end architecture and TEE boundary
- `docs/WORKFLOWS.md`: MiniApp lifecycle + callback workflows
- `docs/DATAFLOWS.md`: request/dataflow + audit tables
- `docs/LAYERING.md`: layering rules + boundaries (what goes where)
- `docs/MODULE_RESPONSIBILITIES.md`: per-module responsibilities + dependency rules
- `docs/API_DOCUMENTATION.md`: gateway/service API reference
- `docs/DEPLOYMENT_GUIDE.md`: deployment paths (Docker, MarbleRun, K8s)
- `docs/MASTER_KEY_ATTESTATION.md`: GlobalSigner key + attestation workflow
- `docs/sdk-guide.md`: MiniApp SDK integration guide
- `docs/service-api.md`: Service API reference

## Smart Contracts (Neo N3 Testnet)

| Contract            | Hash                                         | Description               |
| ------------------- | -------------------------------------------- | ------------------------- |
| PaymentHub          | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` | GAS payments for MiniApps |
| Governance          | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` | NEO staking and voting    |
| PriceFeed           | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` | Oracle price data         |
| RandomnessLog       | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` | VRF attestation anchoring |
| AppRegistry         | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` | MiniApp registration      |
| AutomationAnchor    | `0x1c888d699ce76b0824028af310d90c3c18adeab5` | Automation triggers       |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` | Service request routing   |

### MiniApp Contracts (24 Deployed)

Each MiniApp has its own smart contract that handles app-specific logic and communicates with platform service contracts (PaymentHub, ServiceLayerGateway, etc.) for service requests. All MiniApp contracts use the shared `MiniAppContract` partial class pattern.

**Phase 1 - Gaming:**

| Contract           | Hash                                         | Description               |
| ------------------ | -------------------------------------------- | ------------------------- |
| MiniAppLottery     | `0x3e330b4c396b40aa08d49912c0179319831b3a6e` | Lottery with provable VRF |
| MiniAppCoinFlip    | `0xbd4c9203495048900e34cd9c4618c05994e86cc0` | 50/50 double-or-nothing   |
| MiniAppDiceGame    | `0xfacff9abd201dca86e6a63acfb5d60da278da8ea` | Roll dice, win up to 6x   |
| MiniAppScratchCard | `0x2674ef3b4d8c006201d1e7e473316592f6cde5f2` | Instant win scratch cards |

**Phase 2 - DeFi & Social:**

| Contract                | Hash                                         | Description                |
| ----------------------- | -------------------------------------------- | -------------------------- |
| MiniAppPredictionMarket | `0x64118096bd004a2bcb010f4371aba45121eca790` | Price movement predictions |
| MiniAppFlashLoan        | `0xee51e5b399f7727267b7d296ff34ec6bb9283131` | Instant borrow and repay   |
| MiniAppPriceTicker      | `0x838bd5dd3d257a844fadddb5af2b9dac45e1d320` | Real-time price feeds      |
| MiniAppGasSpin          | `0x19bcb0a50ddf5bf7cefbb47044cdb3ce4cb9e4cd` | Lucky wheel with VRF       |
| MiniAppPricePredict     | `0x6317f97029b39f9211193085fe20dcf6500ec59d` | Binary options trading     |
| MiniAppSecretVote       | `0x7763ce957515f6acef6d093376977ac6c1cbc47d` | Privacy-preserving voting  |
| MiniAppSecretPoker      | `0xa27348cc0a79c776699a028244250b4f3d6bbe0c` | TEE Texas Hold'em          |
| MiniAppMicroPredict     | `0x73264e59d8215e28485420bb33ba841ff6fb45f8` | 60-second predictions      |
| MiniAppRedEnvelope      | `0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e` | Social GAS red packets     |
| MiniAppGasCircle        | `0x7736c8d1ff918f94d26adc688dac4d4bc084bd39` | Daily savings circle       |
| MiniAppCanvas           | `TBD`                                        | Collaborative pixel canvas |

**Phase 3 - Advanced:**

| Contract              | Hash                                         | Description                   |
| --------------------- | -------------------------------------------- | ----------------------------- |
| MiniAppFogChess       | `0x23a44ca6643c104fbaa97daab65d5e53b3662b4a` | Chess with fog of war         |
| MiniAppGovBooster     | `0xebabd9712f985afc0e5a4e24ed2fc4acb874796f` | NEO governance tools          |
| MiniAppTurboOptions   | `0xbbe5a4d4272618b23b983c40e22d4b072e20f4bc` | Ultra-fast binary options     |
| MiniAppILGuard        | `0xd3557ccbb2ced2254f5862fbc784cd97cf746872` | Impermanent loss protection   |
| MiniAppGuardianPolicy | `0x893a774957244b83a0efed1d42771fe1e424cfec` | TEE transaction security      |
| MiniAppCandidateVote  | `TBD`                                        | Vote for candidate & earn GAS |

**Phase 4 - Long-Running:**

| Contract              | Hash                                         | Description                 |
| --------------------- | -------------------------------------------- | --------------------------- |
| MiniAppAITrader       | `0xc3356f394897e36b3903ea81d87717da8db98809` | Autonomous AI trading agent |
| MiniAppGridBot        | `0x0d9cfc40ac2ab58de449950725af9637e0884b28` | Automated grid trading      |
| MiniAppNFTEvolve      | `0xadd18a719d14d59c064244833cd2c812c79d6015` | Dynamic NFT evolution       |
| MiniAppBridgeGuardian | `0x2d03f3e4ff10e14ea94081e0c21e79e79c33f9e3` | Cross-chain asset bridge    |

**Sample Contract:**

| Contract               | Hash                                         | Description                                            |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------ |
| MiniAppServiceConsumer | `0x8894b8d122cbc49c19439f680a4b5dbb2093b426` | Sample callback receiver for on-chain service requests |

See `contracts/README.md` for contract development details.

## Builtin MiniApps Architecture

Each MiniApp consists of:

1. **Frontend Application** - Registered in AppRegistry with an `app_id`
2. **Smart Contract** - Handles app logic and service callbacks
3. **SDK Integration** - Communicates with platform contracts via MiniApp SDK

**Phase 1 - Gaming:**

- `builtin-lottery` - Neo Lottery with provable randomness
- `builtin-coin-flip` - 50/50 double-or-nothing
- `builtin-dice-game` - Roll dice, win up to 6x
- `builtin-scratch-card` - Instant win scratch cards

**Phase 2 - DeFi & Social:**

- `builtin-prediction-market` - Price movement predictions
- `builtin-flashloan` - Instant borrow and repay
- `builtin-price-ticker` - Real-time price feeds
- `builtin-gas-spin` - Lucky wheel with VRF
- `builtin-price-predict` - Binary options trading
- `builtin-secret-vote` - Privacy-preserving voting
- `builtin-secret-poker` - TEE Texas Hold'em
- `builtin-micro-predict` - 60-second predictions
- `builtin-red-envelope` - Social GAS red packets
- `builtin-gas-circle` - Daily savings circle
- `builtin-canvas` - Collaborative pixel art canvas

**Phase 3 - Advanced:**

- `builtin-fog-chess` - Chess with fog of war
- `builtin-gov-booster` - NEO governance tools
- `builtin-turbo-options` - Ultra-fast binary options
- `builtin-il-guard` - Impermanent loss protection
- `builtin-guardian-policy` - TEE transaction security
- `builtin-candidate-vote` - Vote for platform candidate & earn GAS
- `builtin-neoburger` - NeoBurger liquid staking integration

**Phase 4 - Long-Running Processes:**

- `builtin-ai-trader` - Autonomous AI trading agent
- `builtin-grid-bot` - Automated grid trading
- `builtin-nft-evolve` - Dynamic NFT evolution
- `builtin-bridge-guardian` - Cross-chain asset bridge
