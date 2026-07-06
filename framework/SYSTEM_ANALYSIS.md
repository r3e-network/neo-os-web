# MiniApp Framework System Analysis

This document records the current SDK direction after auditing the miniapp and
game entrypoints.

## Findings

- Action registration is now centralized through `ctx.framework.actions`.
- Game entrypoints remain the highest-duplication area. Current main entrypoint
  scan shows repeated direct handling of chain reads, Hash160 conversion,
  reward-game start/finalize/recover calls, and GAS/NEO amount normalization.
- The highest-frequency duplicated patterns are:
  - `chain.read(...)` for pool, credit, active-game, game-state, and stats reads.
  - `addressToScriptHash(...)` before `Hash160` contract args.
  - Reward-game payment selection: existing credit first, prepaid GAS fallback.
  - Local op-log persistence for confidential-compute game sessions.
  - Per-app loading/error/txid state for operation buttons.
- NEO and GAS need one shared amount layer. GAS uses Fixed8; NEO is whole-number
  only and must reject decimals before any transaction is prepared.

## Framework Ownership

The framework should own cross-cutting system work:

- platform detection for OneGate, platform iframe, and standalone launches
- action registration, single-flight execution, notification/error policy
- operation state for user-visible pending/success/failure/txid feedback
- contract argument builders and asset amount normalization
- chain write/payment wrappers and event waiting
- local + OS storage fallback with app-scoped keys
- oracle request envelopes and deterministic digests
- stats, achievements, leaderboards, and small app collections
- Reward Game / GameFi financial and confidential-compute state machine

Miniapps should own product logic and presentation:

- screen layout, gameplay, visual assets, animation, and interactions
- app-specific validation and copy
- app-specific contract method names only when they differ from defaults
- game rules and per-game operation payloads

## Current SDK Layers

- `ctx.framework.actions` is the standard action gateway for all miniapps.
- `ctx.framework.chain.arg` normalizes `Hash160`, integer, string, boolean,
  byte-array, hash256, and array contract args.
- `ctx.framework.amount` standardizes GAS Fixed8 and whole-number NEO handling.
- `ctx.framework.operations` exposes observable operation state for polished UI
  feedback and retry/error recovery.
- `ctx.framework.game.reward(...)` wraps `@framework/gamefi` with current app id,
  chain adapter, OneGate/platform-compatible storage, reward credit, settlement,
  and confidential op-log helpers.

## Migration Priority

1. Reward games: migrate repeated start/finalize/recover/withdraw flows to
   `app.game.reward(...)`.
2. DeFi and finance apps: replace ad hoc amount parsing with `app.amount` and
   `app.chain.arg`.
3. Oracle consoles: route request lifecycle through `app.operations` plus
   deterministic `app.oracle` envelopes.
4. App-specific local persistence: move small state records to `app.db` or
   namespaced `app.storage.hybrid`.
5. UI feedback: bind operation observables instead of per-app bespoke loading,
   error, and last-tx fields where it simplifies the screen.
