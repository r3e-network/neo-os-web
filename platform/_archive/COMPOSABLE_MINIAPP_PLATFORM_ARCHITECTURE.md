> **DEPRECATED (2026-03-31):** This document describes the v1 composable module architecture which has been **fully replaced** by MiniApp-OS v2 direct system service contracts. The ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, and ServiceGateway contracts have been archived under `_archive/deprecated-contracts/`. All 10 OS service contracts are now deployed and all miniapps use the modern `defineMiniApp()` + `ctx.os.*` pattern. See `docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md` for the v2 design spec and `docs/ARCHITECTURE.md` for the current architecture.

# Composable MiniApp Platform Architecture

This document unifies the two composition systems the platform is growing toward:

- `frontend_composition`
- `contract_composition`

The goal is not just reusable code. The goal is a platform where new MiniApps can be assembled from
standardized frontend and contract recipes, while preserving a coherent operator experience and a
consistent user-facing product language.

## Design Principle

Every MiniApp should be described through the same four layers:

1. **Experience layer**
   - what the user sees and how the app is framed
2. **Data layer**
   - what runtime data is read and from where
3. **Operation layer**
   - what actions the user can trigger
4. **Capability layer**
   - which shared contracts/services are needed

The frontend and contract schemas should mirror each other instead of evolving independently.

## Frontend Composition

`frontend_composition` should describe reusable UI/runtime primitives instead of one-off layouts.

Current reusable frontend primitives visible in the host-native runtime:

- `MiniAppPage`
- `ConsoleMiniApp`
- `PlayAreaRegistry`
- `OperationPanel`
- `createMiniApp.ts`

These imply a composable frontend taxonomy:

### Shell Recipes

- `shell.launcher.v1`
- `shell.console.v1`
- `shell.market.v1`
- `shell.game.v1`

These decide:

- outer frame
- default navigation model
- info/detail panel layout
- operation panel placement
- comments/docs presence

### Surface Slots

Each shell exposes named slots that can be filled by frontend recipes:

- `hero`
- `stats`
- `result`
- `operation_panel`
- `activity`
- `docs`
- `comments`
- `details`

### Data Source Recipes

Frontend recipes should not hardcode where data comes from.

Use composable source descriptors such as:

- `shared_mode_runtime`
- `contract_read`
- `catalog_manifest`
- `activity_feed`
- `reviews`
- `forum`

### Operation Recipes

Operations should be described as reusable patterns:

- `invoke_single`
- `invoke_form`
- `shared_binding_invoke`
- `copy_link`
- `open_external`
- `wallet_connect_gate`

### Style Profiles

To unify style and avoid each app inventing its own UI vocabulary:

- `theme_family`
- `density`
- `tone`
- `surface_style`
- `motion_profile`

This should sit above raw colors/fonts and below per-app media assets.

## Contract Composition

`contract_composition` should describe reusable capability bundles.

Current contract-side composition primitives already visible in this repo:

- `ModuleRegistry`
- `RecipeRegistry`
- `MiniAppInstanceRegistry`
- `FundingVault`
- `StreamVesting`
- `MiniAppFactoryV2`

### Runtime Modes

- `template`
  - one deployed template contract
- `shared`
  - no dedicated business contract, shared modules only
- `router`
  - a thin generated router plus shared modules
- `custom`
  - bespoke contract

### Capability Modules

Current and planned examples:

- `module.funding_vault`
- `module.stream_vesting`
- `module.oracle_request`
- `module.random_allocation`
- `module.ticket_nft`
- `module.checkin_redemption`
- `module.marketplace_listing`
- `module.stats_badge`

### Recipes

Recipes are productized combinations of modules:

- `recipe.payment_streams.v1`
- `recipe.gacha.v1`
- `recipe.ticketing.v1`
- `recipe.prediction_market.v1`

## Frontend/Contract Symmetry

The important platform rule is:

- frontend composition chooses **how the app is experienced**
- contract composition chooses **how the app is executed**

They should be linked by stable identifiers, not ad hoc custom code.

For example, a shared-mode NeoPay instance can be described as:

- `frontend_composition.shell_recipe = shell.launcher.v1`
- `frontend_composition.operation_recipes[*].binding = stream`
- `contract_composition.modules[*].binding = stream`

That lets the host runtime bind UI actions directly to shared module methods without a bespoke app
adapter for every MiniApp.

## Recommended Unified MiniApp Shape

```json
{
  "app_id": "miniapp-example",
  "frontend_composition": {
    "shell_recipe": "shell.launcher.v1",
    "shell_version": "1.0.0",
    "surface_slots": {
      "hero": "hero.streams.v1",
      "operation_panel": "panel.stream_builder.v1"
    },
    "data_sources": [
      {
        "id": "shared_runtime",
        "type": "shared_mode_runtime",
        "instance_id": "example:testnet:default"
      }
    ],
    "operation_recipes": [
      {
        "id": "create_stream",
        "binding": "stream",
        "method": "createStream"
      }
    ],
    "style_profile": {
      "theme_family": "finance",
      "density": "compact",
      "tone": "professional"
    }
  },
  "contract_composition": {
    "mode": "shared",
    "instance_id": "example:testnet:default",
    "recipe": {
      "recipe_id": "recipe.payment_streams.v1",
      "version": "1.0.0"
    },
    "modules": [
      {
        "module_id": "module.funding_vault",
        "version": "1.0.0",
        "binding": "vault"
      },
      {
        "module_id": "module.stream_vesting",
        "version": "1.0.0",
        "binding": "stream"
      }
    ]
  }
}
```

## Current Practical Rule

When designing new MiniApps:

- prefer existing shell recipes before custom layout logic
- prefer existing contract recipes before bespoke contracts
- prefer named slot recipes before page-specific component trees
- prefer binding-based operations before hardcoded method wiring

## No-Code Blueprint Contract

To make "publish without writing a contract" operational instead of aspirational, the platform should
treat a no-code MiniApp as three separate artifacts:

1. **User-authored definition**
   - the product-facing MiniApp manifest
   - includes `frontend_composition`, `contract_composition`, tabs, operation schema, docs/media
2. **Operator-resolved blueprint**
   - the approved recipe/module selection and normalized instance metadata
   - still human-readable and reviewable
3. **Deploy/registration plan**
   - the concrete registry hashes, module contract hashes, and instance registration payload sent on-chain

If these three layers are conflated, no-code authoring quickly becomes unsafe or impossible to review.

### User-Editable vs Operator-Managed Fields

For a no-code flow, the builder UI should expose only:

- `app_id`
- `name`, `description`, media/docs
- `frontend_composition.*`
- `contract_composition.mode`
- `contract_composition.recipe.recipe_id`
- `contract_composition.recipe.version`
- `contract_composition.modules[*].binding`
- `contract_composition.modules[*].config`
- `contract_composition.module_bindings`
- `contract_composition.instance_permissions`
- `frontend_ref`

The builder UI should not let end users directly set:

- registry hashes
- module contract hashes
- schema hashes
- router contract hash
- app registry hash
- any value that should come from the operator-approved module/recipe catalog

### Minimal No-Code Publish Sequence

The no-code path should be explicit and always follow the same order:

1. Choose a `shell_recipe` and `contract_composition.recipe`.
2. Fill recipe-required module config and `instance_permissions`.
3. Validate that every `frontend_composition.operation_recipes[*].binding` exists in `contract_composition.module_bindings`.
4. Resolve operator-managed module versions and registry hashes from the catalog.
5. Generate a deploy plan in the same shape consumed by `deploy/scripts/register_modular_instance.go`.
6. Run `--validate-only` before any transaction is signed.
7. Register/import the resulting MiniApp definition into the host/admin layer.

### Minimal Blueprint Shape

The blueprint that sits between the UI form and the final deploy plan should look like:

```json
{
  "app_id": "miniapp-example",
  "frontend_ref": "miniapp.example@1.0.0",
  "frontend_composition": {
    "shell_recipe": "shell.launcher.v1",
    "operation_recipes": [
      {
        "operation": "createThing",
        "binding": "thing",
        "method": "createThing"
      }
    ]
  },
  "contract_composition": {
    "mode": "shared",
    "instance_id": "example:testnet:default",
    "recipe": {
      "recipe_id": "recipe.example.v1",
      "version": "1.0.0"
    },
    "modules": [
      {
        "module_id": "module.example",
        "version": "1.0.0",
        "binding": "thing",
        "config": {}
      }
    ],
    "module_bindings": {
      "thing": {
        "module_id": "module.example",
        "version": "1.0.0"
      }
    },
    "instance_permissions": {}
  }
}
```

### Builder Constraints

The platform should block submission when any of these are false:

- `contract_composition.mode` is one of `shared`, `router`, `template`, `custom`
- `recipe.allowed_runtime_mode` matches the selected mode
- every recipe binding is present exactly once in `module_bindings`
- every operation recipe binding resolves to a bound module
- `shared` mode leaves router deployment fields empty
- `router` mode references an approved router template
- `frontend_ref` points to a frontend package/version already approved by the platform

The example deploy plan at `deploy/config/modular-neopay.shared.example.json` should be treated as the operator-resolved output of this blueprint process, not as the first artifact a no-code user edits by hand.

## Immediate Next Abstractions

Frontend:

- add typed runtime support for `frontend_composition`
- create reusable slot recipe registry
- add host-side renderer selection by `shell_recipe`

Contracts:

- add `oracle_request`
- add `random_allocation`
- add `ticket_nft`
- add `checkin_redemption`

Cross-layer:

- add binding-aware operation execution so frontend recipes can target shared contract modules by
  binding name instead of hardcoded contract hash
