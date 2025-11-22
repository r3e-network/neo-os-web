# JAM Refine/Accumulate Runtime Design

This doc focuses on the execution environment for `refine` and `accumulate` entry points in the JAM-inspired pipeline.

## Goals
- Provide a deterministic, metered sandbox for service code.
- Support longer-running, mostly stateless `refine` and short, stateful `accumulate`.
- Enable future extensibility (child contexts, parallelism) without breaking determinism.

## Execution Model
- **Refine**
  - Stateless (except preimage lookup).
  - Input: WorkPackage items; output: WorkReport (compact data + hashes).
  - Metering: generous CPU/time budget (e.g., up to 6s) with gas accounting.
  - Data limits: input up to ~15 MB per package; output ~90 kB (bounds configurable).
- **Accumulate**
  - Stateful; reads/writes service KV state, transfers balances, emits events.
  - Time budget per item: ~10 ms (configurable).
  - Runs after attestations reach threshold.

## Sandbox Options
- **Wasm (current)**
  - Pros: existing executor; deterministic; tooling.
  - Cons: continuation support is clunky; metering overhead.
- **RISC-V VM (proposed prototype)**
  - Pros: better continuation support; deterministic; performant on x86/ARM; easier gas metering.
  - Cons: new dependency; need host functions for state/preimage access.
- Plan: keep Wasm for compatibility; add RISC-V prototype behind a feature flag and benchmark.

## Host Functions
- Preimage lookup by hash (Refine).
- State read/write (Accumulate) scoped to service namespace.
- Transfer/balance adjustments (Accumulate).
- Emit events/logs.
- Create/upgrade services (Accumulate) in future phases.

## Metering
- Track wall-clock and instruction/gas; abort when exceeded.
- Separate budgets:
  - `refine_max_ms`, `refine_max_bytes_out`
  - `accumulate_max_ms_per_item`
- Include engine version in report hash to avoid replay after engine upgrades.

## Child Contexts / Parallelism (future)
- Allow `refine` to spawn child contexts for parallelizable tasks with bounded gas; aggregate outputs.
- Keep deterministic ordering; disallow nondeterministic sources.

## Persistence Hooks
- Persist reports with engine/version info for replay verification.
- Optionally store traces (limited size) for debugging.

## Implementation Steps
1) Define interfaces for sandbox engines (already in `jam` package for Refiner/Accumulator).
2) Add per-phase budget config; enforce in engine.
3) Prototype RISC-V executor and compare to Wasm executor; expose via config switch.
4) Add preimage/state host functions to chosen executor.
5) Include engine/version in WorkReport for attest/replay.
6) Add tests for budget enforcement and determinism across runs.
