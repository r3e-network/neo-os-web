# Modular Capability Composition for No-Code MiniApp Contracts

This document defines the next-step contract architecture after the current template-based factory model.

The goal is not just "parameterized template deployment", but a stronger end-state:

- a developer can publish a new MiniApp without writing a bespoke contract,
- most apps can run on shared capability contracts,
- only the small minority of truly novel state machines require a custom contract,
- the platform can decide between:
  - `shared` mode: no new business contract deployment,
  - `router` mode: deploy a lightweight generated router/orchestrator,
  - `custom` mode: bespoke contract when composition is not enough.

## Executive Summary

Yes, this is feasible, but not in the naive "just dynamically stitch contract code together" sense.

On Neo N3, the realistic professional architecture is:

1. Keep a **registry-driven module system** for shared capabilities.
2. Key all shared state by **app instance id**.
3. Offer **recipe bundles** for common MiniApp categories.
4. Use a **thin generated router contract** only when atomic multi-module orchestration is required.
5. Reserve bespoke contracts for genuinely unique economic/state-machine logic.

That gives the platform a practical no-code publishing path without pretending every app should share one giant generic contract.

## Why The Current Repo Already Points In This Direction

Several existing layers already show the right direction:

- `contracts/MiniApp.DevPack/MiniAppBase.cs`
  - common admin/oracle/pause/direct-credit logic is already centralized.
- `contracts/MiniApp.DevPack/MiniAppGameBase.cs`
  - reusable game/bet-limit/RNG request patterns already exist as a capability family.
- `contracts/MiniApp.DevPack/MiniAppServiceBase.cs`
  - reusable oracle callback / automation patterns already exist as a capability family.
- `contracts/MiniAppTemplates/MiniAppTemplate.Base.cs`
  - template contracts already support config schema + operation schema.
- `contracts/MiniAppFactoryV2/MiniAppFactoryV2.cs`
  - factory already manages template catalog + schema + deployment records.
- `contracts/MiniAppTemplates/Template.Prediction.cs`
- `contracts/MiniAppTemplates/Template.Governance.cs`
- `contracts/MiniAppTemplates/Template.Airdrop.cs`
  - the platform already supports "parameter-driven, no custom code" for some categories.
- `platform/README.md`
  - the platform already claims a template-first/no-code direction.
- `neo-abstract-account/contracts/hooks/MultiHook.cs`
- `neo-abstract-account/contracts/hooks/HookAuthority.cs`
- `neo-abstract-account/contracts/verifiers/VerifierAuthority.cs`
  - AA already proves that registry-authorized modular composition is a workable pattern in this ecosystem.

## Hard Constraint: Neo N3 Is Not EVM `delegatecall`

The current factory path in `contracts/MiniAppFactoryV2/MiniAppFactoryV2.cs` uses:

- `ContractManagement.Deploy(...)` for per-template deployment
- `Contract.Call(...)` for cross-contract interaction

That means the platform cannot rely on EVM-style `delegatecall`-based "module code sharing with local storage" composition.

This has two consequences:

1. Shared modules must own their own storage and namespace it by `instanceId`.
2. When multiple modules need strict atomic orchestration, the clean option is a generated router/orchestrator contract.

So the modular target is:

- **shared stateful capability contracts** plus
- **optional lightweight app router templates**

not "dynamic code stitching inside one contract storage context".

## Recommended Three-Tier Contract Model

### 1. Capability Modules

Each module is a shared contract used by many MiniApps.

Every module should:

- store state by `instanceId`,
- validate a configured `AuthorizedCore` / `AuthorizedRegistry`,
- expose schema for init params and operation params,
- emit structured instance-scoped events,
- support per-instance pause/admin/owner controls,
- avoid app-specific product semantics in its storage layout.

### 2. Recipe Bundles

A recipe defines:

- which modules are required,
- allowed module combinations,
- required init schemas,
- UI operation schemas,
- capability/risk profile,
- whether the recipe can run in `shared` mode or requires `router` mode.

Examples:

- `recipe.payment_streams.v1`
- `recipe.red_envelope.v1`
- `recipe.ticketing.v1`
- `recipe.gacha.v1`
- `recipe.prediction_market.v1`

### 3. App Instance Registration

An app instance should register:

- `instance_id`
- `app_id`
- `recipe_id`
- `mode: shared | router | custom`
- enabled modules
- per-module config hashes / raw config
- frontend template reference
- runtime permissions / capability profile

This registration is the thing the platform publishes, indexes, and renders.

## Proposed On-Chain Components

### ModuleRegistry

Stores:

- `module_id`
- contract hash
- version
- init schema hash
- operation schema hash
- risk profile
- compatibility metadata

Responsibilities:

- activate/deactivate module versions
- resolve module hash by `module_id + version`
- publish schema hashes for validation

### RecipeRegistry

Stores:

- `recipe_id`
- version
- allowed module graph
- required fields
- allowed runtime mode
- optional router template id

Responsibilities:

- define canonical app blueprints
- validate module bundles
- provide no-code builder metadata

### MiniAppInstanceRegistry

Extends the current `AppRegistry` concept.

Stores:

- app metadata
- instance metadata
- recipe reference
- module bindings
- owner / operator / developer
- pause / status / upgrade status

Responsibilities:

- register shared-mode apps with no dedicated app contract
- register router-mode apps with deployed router hash
- provide host/runtime discovery for the frontend

### Optional Instance Router Template

This is a generated contract for the cases where:

- multiple modules must be invoked atomically,
- invariants span multiple modules,
- product logic is still standard enough to be generated,
- but shared-mode direct calls would be too fragmented.

This keeps no-code deployment while avoiding a bespoke contract.

## Recommended Capability Modules

These modules align closely with the code that is already duplicated or semi-centralized today.

### 1. Funding / Vault Module

Use for:

- direct GAS credit
- NEP-17 escrow
- NEP-11 escrow
- withdraw/refund/reclaim logic

Evidence in current repo:

- `MiniAppBase` direct credit support
- `MiniAppNeoPay`
- `MiniAppRedEnvelope`
- `MiniAppFogPlay`
- `MiniAppGASBox`
- `MiniAppEventTicketPass`

### 2. Oracle Request Module

Use for:

- RNG
- price feed
- HTTP/data lookup
- encryption/decryption
- confidential reference bridges

Evidence:

- `MiniAppServiceBase`
- `MiniAppGameBase`
- `MiniAppOnChainTarot`
- `MiniAppFogPlay`
- `MiniAppRedEnvelope`
- `MiniAppGASBox`

### 3. Random Allocation / Draw Module

Use for:

- random amount split
- weighted draw
- deterministic seed replay
- result settlement

Evidence:

- `MiniAppRedEnvelope`
- `MiniAppFogPlay`
- `MiniAppGASBox`

### 4. Stream / Vesting Module

Use for:

- recurring release schedules
- beneficiary claims
- creator cancellation / refund

Evidence:

- `MiniAppNeoPay`

### 5. Ticket / Credential NFT Module

Use for:

- NEP-11 issuance
- ticket metadata
- soulbound credential issuance
- transfer restrictions / SBT policy

Evidence:

- `MiniAppEventTicketPass`
- `MiniAppSoulboundCertificate`

### 6. Check-In / Redemption Module

Use for:

- one-time use marking
- QR/attendance redemption
- operator-authorized consume flows

Evidence:

- `MiniAppEventTicketPass`

### 7. Governance / Voting Module

Use for:

- proposal lifecycle
- weighted voting
- execution/quorum rules

Evidence:

- `Template.Governance`
- `MiniAppMasqueradeDAO`
- `MiniAppGovMerc`

### 8. Marketplace / Listing Module

Use for:

- list for sale
- cancel sale
- royalty splits
- machine / asset secondary sale

Evidence:

- `MiniAppGASBox`
- AA address market patterns in `neo-abstract-account/contracts/market/AAAddressMarket.cs`

### 9. Time / Expiry / Automation Module

Use for:

- expiry windows
- periodic execution
- auto-settlement
- cleanup/refund after timeout

Evidence:

- `MiniAppServiceBase`
- `MiniAppRedEnvelope`
- `MiniAppLastSurvivor`
- `MiniAppDailyCheckin`

### 10. Stats / Badge / Achievement Module

Use for:

- reusable on-chain counters
- badge issuance thresholds
- season/user summaries

Evidence:

- `MiniAppDailyCheckin`
- `MiniAppLastSurvivor`
- `MiniAppSelfLoan`
- `MiniAppGraveyard`
- `MiniAppHallOfFame`

## Which Apps Can Become Pure Composition vs Need A Router

### Strong Shared-Mode Candidates

These can realistically run with no dedicated app contract:

- airdrop / faucet
- simple governance vote
- simple prediction market
- simple payment stream
- simple ticket issuance
- soulbound certificate issuance
- check-in / attendance proofs

These already map cleanly to one or two modules plus config.

### Router-Mode Candidates

These likely need a generated orchestrator but not bespoke code:

- red envelope
- fogplay
- gasbox
- milestone escrow
- time capsule

Reason:

- they combine escrow + randomness + settlement + state transitions,
- but the pattern is still standardized enough to be captured as a recipe.

### Bespoke / Advanced Candidates

These may still need custom logic, at least initially:

- last survivor
- some complex DAO/governance experiments
- highly custom social/economic games

Reason:

- the invariant graph is more unique,
- payout/time/referral/dividend mechanics are tightly coupled,
- forcing them into generic modules too early would create fragile abstractions.

## Suggested Recipe Mapping For Existing MiniApps

### `MiniAppNeoPay`

Recipe:

- `funding_vault`
- `stream_vesting`

Mode:

- `shared`

### `MiniAppEventTicketPass`

Recipe:

- `event_registry`
- `ticket_nft`
- `checkin_redemption`
- optional `credential_bridge`

Mode:

- `shared` or `router`

### `MiniAppSoulboundCertificate`

Recipe:

- `credential_template_registry`
- `sbt_issue`
- optional `issuer_policy`

Mode:

- `shared`

### `MiniAppRedEnvelope`

Recipe:

- `funding_vault`
- `oracle_rng`
- `random_allocation`
- `claim_once`
- `expiry_refund`

Mode:

- `router`

### `MiniAppFogPlay`

Recipe:

- `funding_vault`
- `oracle_rng`
- `wager_settlement`
- `payout`

Mode:

- `router`

### `MiniAppGASBox`

Recipe:

- `inventory_escrow`
- `oracle_rng` or deterministic-draw module
- `weighted_draw`
- `sale_listing`
- `royalty_split`

Mode:

- `router`

### `MiniAppLastSurvivor`

Recipe:

- `round_timer`
- `contribution_curve`
- `winner_split`
- `dividend_split`
- `referral_rewards`

Mode:

- likely `custom` first, maybe later a specialized router recipe

## Concrete End-to-End Examples

### Example A. NeoPay in `shared` Mode

This is the cleanest first production slice because the app can be expressed as registry state plus
two reusable modules.

#### Recipe

- `recipe.payment_streams.v1`
- modules:
  - `module.funding_vault`
  - `module.stream_vesting`

#### Publish Flow

1. Admin/backend validates the app definition against `recipe.payment_streams.v1`.
2. `MiniAppInstanceRegistry` allocates `instanceId = "neopay:<appId>"`.
3. Registry stores:
   - `mode = shared`
   - recipe reference
   - module bindings
   - module config hashes
   - frontend manifest reference
4. Backend calls:
   - `FundingVault.InitializeInstance(instanceId, vaultConfig)`
   - `StreamVesting.InitializeInstance(instanceId, streamConfig)`
5. No dedicated business contract is deployed.

#### Example Instance Payload

```json
{
  "app_id": "miniapp-neo-pay",
  "instance_id": "neopay:mainnet:default",
  "contract_mode": "shared",
  "contract_recipe": {
    "recipe_id": "recipe.payment_streams.v1",
    "version": "1.0.0"
  },
  "contract_modules": [
    {
      "module_id": "module.funding_vault",
      "version": "1.0.0",
      "binding": "vault",
      "config": {
        "accepted_assets": [
          "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
          "0xd2a4cff31913016155e38e474a2c06d08be276cf"
        ],
        "deposit_mode": "direct_nep17_credit",
        "allow_creator_refund": true
      }
    },
    {
      "module_id": "module.stream_vesting",
      "version": "1.0.0",
      "binding": "stream",
      "config": {
        "min_interval_seconds": 86400,
        "max_interval_seconds": 31536000,
        "max_title_length": 60,
        "max_notes_length": 240,
        "supports_creator_cancel": true,
        "supports_beneficiary_claim": true
      }
    }
  ],
  "instance_permissions": {
    "oracle": false,
    "automation": false,
    "escrow_assets": ["NEO", "GAS"]
  },
  "router_template_ref": null,
  "frontend_template_ref": "miniapp.neo-pay.v1"
}
```

#### Runtime Flow

1. Frontend loads the app manifest and sees `contract_mode = shared`.
2. Host/runtime resolves `instanceId` and module bindings from `MiniAppInstanceRegistry`.
3. "Create stream" calls the shared stream module with:
   - `instanceId`
   - creator
   - beneficiary
   - token
   - schedule params
4. "Claim stream" calls the shared stream module with:
   - `instanceId`
   - streamId
   - claimer
5. Funding/escrow state is read from the shared vault module, always namespaced by `instanceId`.

#### Why It Fits Shared Mode

- no atomic cross-module state machine beyond normal stream creation/claim
- module boundaries are clean
- frontend can call one module at a time without a router

### Example B. GASBox in `router` Mode

GASBox is a good router candidate because one user action crosses inventory, escrow, randomness, and
settlement, and that orchestration should stay behind one stable contract surface.

#### Recipe

- `recipe.gacha.v1`
- modules:
  - `module.inventory_escrow`
  - `module.oracle_rng`
  - `module.weighted_draw`
  - `module.sale_listing`
  - optional `module.royalty_split`
- router template:
  - `router.gacha.v1`

#### Publish Flow

1. Admin/backend validates the app definition against `recipe.gacha.v1`.
2. `MiniAppFactoryV2` deploys a lightweight router from `router.gacha.v1`.
3. `MiniAppInstanceRegistry` stores:
   - `mode = router`
   - deployed router hash
   - bound shared module hashes
   - per-module config
   - frontend manifest reference
4. Backend initializes each shared module with the same `instanceId`.
5. Backend initializes the router with:
   - `instanceId`
   - registry/module references
   - recipe version

#### Runtime Flow

1. Frontend talks only to the router contract for `play`, `deposit`, `withdraw`, `list`, and
   `settle`.
2. Router verifies the recipe wiring for the `instanceId`.
3. `play(...)`:
   - locks payment through `inventory_escrow`
   - requests randomness from `oracle_rng`
   - records pending play state under the router/app context
4. `settle(...)`:
   - reads the random seed
   - calls `weighted_draw`
   - updates inventory
   - transfers payout / marks claimable result
5. Secondary-market actions call through the router into `sale_listing` so inventory and sale state
   stay consistent.

#### Why It Fits Router Mode

- one user action spans multiple modules with shared invariants
- app still reuses shared capability contracts
- router keeps the frontend contract surface simple and atomic

## Shared Mode vs Router Mode

### Shared Mode

No new business contract is deployed.

The app is created by:

1. validating recipe + module config,
2. allocating a new `instanceId`,
3. writing instance config into `MiniAppInstanceRegistry`,
4. calling `InitializeInstance(...)` on each shared module,
5. registering frontend manifest + entry metadata.

Pros:

- no per-app contract deployment
- lowest operator overhead
- easiest path for true no-code

Cons:

- frontend or AA bundle may need to call multiple contracts directly
- cross-module invariants are harder to keep atomic

### Router Mode

Deploy a lightweight generated router contract from a fixed router template.

The router:

- stores module addresses or resolves them from registries,
- validates the recipe wiring,
- orchestrates calls across modules in one transaction,
- owns no unique business code beyond a standard recipe executor.

Pros:

- preserves atomicity
- gives each app a stable contract surface
- still avoids bespoke development

Cons:

- still deploys one small contract per app instance

This is the right compromise for many transactional apps.

## Required Metadata / Schema Evolution

The current template-market fields are still template-centric:

- `factory_template_ref`
- `init_params`
- `init_schema`
- `method_schema`

To support modular composition cleanly, add a new contract composition block:

```json
{
  "contract_mode": "shared",
  "contract_recipe": {
    "recipe_id": "recipe.ticketing.v1",
    "version": "1.0.0"
  },
  "contract_modules": [
    {
      "module_id": "module.ticket_nft",
      "version": "1.2.0",
      "config": {
        "transferable": true,
        "burn_on_redeem": false
      }
    },
    {
      "module_id": "module.checkin_redemption",
      "version": "1.0.0",
      "config": {
        "operator_policy": "event_creator_only"
      }
    }
  ],
  "router_template_ref": null,
  "instance_permissions": {
    "oracle": false,
    "automation": false,
    "escrow_assets": ["GAS"]
  }
}
```

### Minimal Backend/Admin Changes

The platform already has a good starting point in:

- `platform/host-app/lib/template-market.ts`
- `platform/admin-console/src/app/miniapps/lib/template-install.ts`
- `platform/host-app/lib/miniapp-admin.ts`

The next step is to add first-class support for:

- `contract_mode`
- `contract_recipe_ref`
- `contract_modules`
- `router_template_ref`
- `module_config_schema`
- `instance_permissions`
- `module_bindings`

## No-Code Blueprint Validation Contract

To make the modular path practical for non-contract authors, the platform needs a strict contract
between:

- the MiniApp builder UI,
- the operator catalog,
- the registration script,
- and the on-chain registries.

The important rule is:

- users author a **blueprint**
- operators resolve a **plan**
- scripts submit a **registration**

These are not the same artifact, and each layer should validate different things.

### Blueprint Layer Requirements

The user-authored blueprint should contain only product and recipe choices:

- `app_id`
- `frontend_ref`
- `contract_mode`
- `contract_recipe`
- `contract_modules[*].binding`
- `contract_modules[*].config`
- `module_bindings`
- `instance_permissions`

The blueprint should not directly carry:

- registry hashes
- module contract hashes
- app registry hash
- router contract hash
- schema hashes

Those belong to the operator-managed plan because they come from approved deployment catalogs.

### Plan Layer Requirements

The operator-resolved plan should add:

- `module_registry_hash`
- `recipe_registry_hash`
- `instance_registry_hash`
- `app_registry_hash`
- `modules[*].contract_hash`
- `modules[*].init_schema_hash`
- `modules[*].operation_schema_hash`
- `instance.config_hash`

This plan is the first artifact that should be consumable by
`deploy/scripts/register_modular_instance.go`.

### Hard Validation Rules

The builder/admin layer should reject the flow before deployment when:

1. `instance.runtime_mode` is not one of `shared`, `router`, `template`, `custom`
2. `recipe.allowed_runtime_mode` does not match `instance.runtime_mode`
3. `shared` mode contains a non-empty `instance.router_contract`
4. `router` mode lacks either a `recipe.router_template_id` or deployed router hash at execution time
5. any `recipe.module_refs[*].binding` is missing from `instance.module_bindings`
6. any `instance.module_bindings[*]` points to a module/version not present in the operator-approved module catalog
7. any frontend operation binding references a binding not present in `instance.module_bindings`
8. `frontend_ref` is not pinned to an approved frontend package/version
9. `instance.owner` / `instance.developer` are not explicitly set
10. `required_fields` in the recipe are not fully satisfied by blueprint input

### Recommended Builder UX Contract

The builder should expose exactly three review surfaces:

1. **Recipe form**
   - user fills module config, permissions, and UI metadata
2. **Resolved blueprint summary**
   - user sees bindings, runtime mode, frontend ref, and required fields
3. **Operator plan preview**
   - operator sees registry hashes, module hashes, and validation output before signing

The builder should also support a one-click dry validation path:

```bash
go run -tags=scripts deploy/scripts/register_modular_instance.go \
  --plan deploy/config/modular-neopay.shared.example.json \
  --validate-only
```

That command should be treated as mandatory in the no-code publish flow, not optional documentation.

### Minimal Generic Blueprint

The most portable no-code blueprint shape should be:

```json
{
  "app_id": "miniapp-example",
  "frontend_ref": "miniapp.example@1.0.0",
  "contract_mode": "shared",
  "contract_recipe": {
    "recipe_id": "recipe.example.v1",
    "version": "1.0.0"
  },
  "contract_modules": [
    {
      "module_id": "module.example",
      "version": "1.0.0",
      "binding": "primary",
      "config": {}
    }
  ],
  "module_bindings": {
    "primary": {
      "module_id": "module.example",
      "version": "1.0.0"
    }
  },
  "instance_permissions": {}
}
```

This blueprint is what a no-code user should author.

The deploy plan example at `deploy/config/modular-neopay.shared.example.json`
is the next layer: the operator-resolved plan that adds registry and contract hashes.

## Recommended Evolution of Factory / Registry Contracts

### Keep `MiniAppFactoryV2`

Do not discard it.

Instead, split responsibilities:

- `MiniAppFactoryV2` remains responsible for router/custom template deployment.
- New `ModuleRegistry` manages shared module catalog.
- New `RecipeRegistry` manages allowed compositions.
- `AppRegistry` evolves into or is complemented by `MiniAppInstanceRegistry`.

### Migration Rule

- existing template-based apps continue to work,
- new apps can choose:
  - contract template deployment,
  - shared-module composition,
  - router recipe deployment.

This avoids a risky big-bang migration.

## Migration Path

### Phase 1. Registry Foundations

Build:

- `ModuleRegistry`
- `RecipeRegistry`
- `MiniAppInstanceRegistry`

No app migrations yet.

### Phase 2. Shared-Mode Recipes

Ship the easiest recipes first:

- airdrop
- governance vote
- payment stream
- certificate issue
- ticketing

These produce the fastest "no custom contract" wins.

### Phase 3. Router Recipes

Add generated router recipes for:

- red envelope
- fogplay
- gasbox
- milestone escrow

### Phase 4. Advanced Decomposition

Evaluate whether:

- last survivor,
- high-custom games,
- complex governance flows

should remain custom or gain specialized router bundles.

## Decision

The correct platform direction is:

- **not** "every miniapp keeps a bespoke contract forever",
- **not** "force every app into one monolithic generic contract",
- but **a layered capability architecture with shared modules, recipe bundles, and optional generated routers**.

That approach matches:

- current DevPack capability families,
- current template-factory direction,
- AA's proven hook/verifier authority pattern,
- Neo N3's actual execution/storage constraints.

## Recommended Immediate Next Step

Implement one vertical slice first:

- `module.funding_vault`
- `module.stream_vesting`
- `recipe.payment_streams.v1`
- `MiniAppInstanceRegistry`

Use `MiniAppNeoPay` as the first migration candidate.

It is the cleanest proof that:

- users can launch a useful MiniApp with no bespoke contract,
- the host/admin flow can configure and publish it,
- the platform can support shared mode before tackling more complex games.
