# Platform Contract Composition Design

Date: 2026-05-05

## Purpose

Neo MiniApps should prefer shared, composable platform contracts over one contract per miniapp. A miniapp should register itself into one or more platform capability contracts, then call those contracts with its `appId` as the tenant namespace. Dedicated miniapp contracts remain available only when a feature cannot be represented cleanly by the shared platform layer.

This design keeps the platform smaller, easier to audit, and easier to operate on mainnet. It also matches the current repository direction: the active contract source already contains `PlatformGame`, `PlatformSocial`, `PlatformDeFi`, and `PlatformAnchor`, and tests explicitly reject restoring legacy root-level platform contracts.

## Current Evidence

The repository already has four multi-tenant platform contracts:

| Contract | Capability surface | Tenant mechanism |
| --- | --- | --- |
| `PlatformGame` | countdown, coin flip, gacha | `registerGame(appId, gameType, appAdmin, config)` |
| `PlatformSocial` | red envelope, trust, bounty vault | `registerApp(appId, appType, appAdmin, config)` |
| `PlatformDeFi` | lending, flash loan, capsule | `registerProduct(appId, productType, appAdmin, config)` |
| `PlatformAnchor` | TrustAnchor and ProfitAnchor staking, rewards, AA voting | `registerAnchorApp(appId, mode, appAdmin)` |

Existing deployment evidence:

- `PlatformAnchor` is deployed on mainnet and testnet and has registrations for `miniapp-trustanchor` and `miniapp-profitanchor`.
- `PlatformGame` is deployed on testnet and has a deployed validation path for `miniapp-last-survivor`.
- `PlatformDeFi` is deployed on testnet and has been used by the SelfLoan validation flow.
- Git history contains many deleted per-miniapp contracts, but restoring all of them would reverse the platform consolidation.

## Design Goals

1. Use platform contracts as the default execution layer for miniapps.
2. Keep each miniapp isolated by `appId` inside shared contract storage.
3. Make frontend routing and operation panels consume a single runtime descriptor instead of hardcoded per-app contract hashes.
4. Preserve strict mainnet/testnet separation in manifests, APIs, deploy scripts, and browser flows.
5. Keep dedicated contracts only for protocol-specific, NEP-standard, or high-risk state machines that do not fit a shared module.

## Non-Goals

- Do not restore every historical miniapp contract directory.
- Do not deploy or update mainnet contracts until testnet registration, frontend flows, and read/write smoke tests pass.
- Do not put unsupported apps in the mainnet catalog by assigning fake platform hashes.
- Do not merge unrelated old registry stacks such as `AppRegistry`, `ServiceGateway`, or `UniversalMiniApp` back into active source.

## Options Considered

### Option A: Platform Contracts First, Dedicated Contracts As Fallback

Miniapps declare the platform contract, module type, registration method, appId, and operation bindings. Shared contracts are deployed once per network. Each miniapp is registered as a tenant. Frontend reads and writes route through a runtime resolver.

This is the recommended option. It matches current source, reduces audit scope, and keeps deployment count small.

### Option B: Restore All Historical Miniapp Contracts

Recover every deleted contract from Git history and resume one-contract-per-miniapp.

This is technically possible for many apps, but it greatly increases audit, deployment, upgrade, and monitoring cost. It also conflicts with the current consolidation tests.

### Option C: Hybrid With No Runtime Standard

Keep current mixed state: some apps use platform contracts, some use old dedicated hashes, and frontend code handles exceptions.

This is the current pain point. It is flexible but hard to reason about, easy to misroute across networks, and difficult to verify systematically.

## Recommended Architecture

### 1. Runtime Descriptor In Manifests

Each miniapp manifest should have a canonical platform runtime section. The existing `contracts` field may remain for compatibility, but platform-enabled apps should derive it from runtime metadata.

Suggested shape:

```json
{
  "runtime": {
    "mode": "platform",
    "modules": [
      {
        "binding": "game",
        "platform": "PlatformGame",
        "app_id": "miniapp-last-survivor",
        "module_type": "countdown",
        "registration": {
          "method": "registerGame",
          "type": 1
        },
        "networks": {
          "neo-n3-testnet": {
            "contract_hash": "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
            "registered": true
          },
          "neo-n3-mainnet": {
            "contract_hash": "",
            "registered": false
          }
        },
        "operations": {
          "primary": "buyCountdownKeys",
          "read_status": "getCountdownStatus"
        }
      }
    ]
  }
}
```

For multi-module apps, `modules` can include more than one binding. Example: SelfLoan can bind `PlatformDeFi` for lending and `PlatformAnchor` for ProfitAnchor voting.

### 2. Runtime Resolver

Host app code should resolve contract calls through a shared helper:

```ts
resolveMiniAppRuntime(app, network)
```

It should return:

- active network
- appId
- platform contract hash
- platform contract name
- module binding
- registration status
- read methods
- write operation bindings
- whether writes are disabled and why

The resolver should be the only source used by:

- live status reads
- activity event filters
- operation panel write target construction
- miniapp detail safety banners
- deployment and verification scripts

### 3. Registration Flow

Deployment should be two-phase:

1. Deploy or update the platform contract for a network.
2. Register each miniapp tenant with the correct appId and type.

Registration must be idempotent:

- If app is already registered with same type and admin, mark as ok.
- If app is registered with a different type or admin, fail loudly.
- If platform contract hash is missing, keep the app out of that network catalog.

Verification after registration:

- `getGameType(appId)` or equivalent returns expected type.
- `getGameAdmin(appId)` or equivalent returns expected admin.
- module read method returns the expected VM stack type.
- write smoke tests run on testnet before mainnet.

### 4. Frontend Operation Binding

Operation definitions should not manually ask users for `appId`. The `appId` is injected by the runtime resolver as a hidden first argument when the platform ABI requires it.

Example:

- UI action: "Buy keys"
- Runtime method: `buyCountdownKeys(appId, player, keyCount)`
- User inputs: `keyCount`
- Wallet payload: appId from manifest, player from wallet, keyCount from user

This prevents user mistakes and makes OneGate/NEP-21 dapp loading simpler.

### 5. Mainnet And Testnet Isolation

Network selection must be explicit in every layer:

- catalog API
- miniapp detail pages
- activity event APIs
- runtime resolver
- wallet adapter
- deploy scripts
- verification scripts

If a miniapp has only testnet runtime metadata, it must not appear in the mainnet catalog. If mainnet exists but is not registered, writes should be disabled with a clear reason.

## Migration Inventory

### Tier 0: Already Platform-Oriented

- `miniapp-profitanchor`: `PlatformAnchor`, mode `2`
- `miniapp-trustanchor`: `PlatformAnchor`, mode `1`
- `miniapp-self-loan`: `PlatformDeFi`, lending product, testnet validated
- `miniapp-last-survivor`: `PlatformGame`, countdown game, testnet validated

### Tier 1: Direct Fit To Existing Platform Contracts

- `miniapp-fogplay`: `PlatformGame`, coin flip
- `miniapp-gasbox`: `PlatformGame`, gacha
- `miniapp-redenvelope`: `PlatformSocial`, envelope
- `miniapp-unbreakablevault`: `PlatformSocial`, vault
- `miniapp-flashloan`: `PlatformDeFi`, flash loan

These should migrate before restoring any dedicated contracts.

### Tier 2: Needs New Platform Capability Modules

- `miniapp-dailycheckin`: add an engagement/check-in capability.
- `miniapp-neo-pay`: add stream/payment capability, or revive the shared-mode payment stream runtime if still compatible.
- `miniapp-event-ticket-pass`: add NEP-11 ticket/certificate capability, or keep dedicated if NEP-11 identity must be independent.
- `miniapp-soulbound-certificate`: add soulbound NEP-11 capability, or dedicated if standard compliance requires separate contract identity.
- `miniapp-milestone-escrow`: add escrow capability.
- `miniapp-quadratic-funding`: add funding/governance capability.
- `miniapp-dev-tipping`: add tipping capability.
- `miniapp-burn-league`: add burn/leaderboard/reward capability.
- `miniapp-council-governance`: add governance proposal/vote capability.
- `miniapp-memorial-shrine`: add memorial/tribute capability.
- `miniapp-time-capsule`: add timelock/content proof capability.
- `miniapp-onchaintarot`: add randomness/reading capability, preferably via Morpheus VRF.
- `miniapp-gas-sponsor`: add sponsor pool capability.

Git history can be used as a reference for method behavior, but the first choice should be platform module extraction, not full contract restoration.

### Tier 3: External Protocol Or Tool Apps

- `miniapp-neo-ns`: should point to the real NeoNS contract, not a platform module.
- `miniapp-neo-swap`: should integrate the real swap protocol/router if supported.
- `miniapp-neo-x-bridge`: should integrate AxLabs/BaneLabs bridge and message bridge.
- Wallet, explorer, conversion, signature, AA lab, and oracle console apps may not need miniapp contracts.

## Dedicated Contract Fallback Criteria

Use a dedicated contract only if one of these is true:

1. The app must expose a distinct NEP-standard contract identity.
2. The app relies on a protocol-owned external contract with its own upgrade and governance model.
3. The state machine is too specialized or risky to share safely.
4. The app needs isolated permissions that would make a platform contract too broad.
5. Restoring historical code is faster and safer than building a new generic capability, and the app is important enough to justify the extra audit surface.

## Security Requirements

- Every platform write method must check registration and app pause state.
- Every user-money path must require user witness or a narrowly authorized AA path.
- Every token intake must validate `Runtime.CallingScriptHash`.
- Every token transfer must assert success.
- Randomness must come from Morpheus VRF or another unpredictable source, not predictable local state.
- App admin must not be able to withdraw user funds.
- Mainnet write actions stay disabled until registration and testnet smoke tests pass.
- Activity and read APIs must not hardcode testnet when the page is on mainnet.

## Implementation Sequence

1. Add runtime descriptor schema and tests.
2. Add a runtime resolver in host app.
3. Convert flagship reads and operation bindings to the resolver.
4. Update manifests for Tier 0 and Tier 1 apps.
5. Add idempotent registration verification scripts for platform contracts.
6. Run testnet deploy/register/smoke for Tier 1.
7. Only after testnet passes, update mainnet manifests and deploy/register missing platform contracts.
8. For Tier 2, design and implement one platform capability at a time.
9. For any app that fails platform fit, restore historical dedicated contract source into a clearly marked fallback directory and audit it before deployment.

## Validation Gates

Before a miniapp is marked production-ready on a network:

- Manifest validates against runtime schema.
- Runtime resolver returns the expected platform hash and appId.
- On-chain registration read confirms the appId and type.
- Safe read methods return healthy values.
- Frontend detail page renders playarea, info, and action panel.
- Wallet buttons do not send writes before wallet connection and user confirmation.
- Testnet write smoke passes for all critical operations.
- Mainnet read smoke passes after deployment or registration.
- Mainnet write smoke is only performed with explicit funded signer and transaction review.

## Open Decisions

1. Whether to name the manifest section `runtime`, `platform_runtime`, or extend existing `contract` metadata.
2. Whether to revive the older `ModuleRegistry` and `RecipeRegistry` concept, or keep runtime resolution off-chain in manifests for now.
3. Whether NEP-11-like apps should share a platform NFT contract or keep dedicated contracts for clearer token identity.
4. Whether Tier 2 modules should be grouped into a few broad contracts or several smaller capability contracts.

## Recommendation

Proceed with Option A. First finish the runtime descriptor and resolver, then migrate Tier 0 and Tier 1. This gives a clean path to fully platform-based miniapps without losing the fallback option of restoring historical contracts where a shared module is not appropriate.
