# MiniApp Shell + Stats Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract a shared `MiniAppShell` layout wrapper and shared stats panel components, then migrate miniapp index pages to reduce repeated template/slot boilerplate while preserving behavior.

**Architecture:** Introduce thin wrapper components in `miniapps/shared/components` that compose existing `MiniAppTemplate`, `ErrorBoundary`, `NeoCard`, and `NeoStats` primitives. Keep backward compatibility by preserving existing slot names and forwarding props/events to existing internals. Migrate apps incrementally with codemod-like edits, then validate with existing miniapp validation and build pipelines.

**Tech Stack:** Vue 3 SFCs, TypeScript, Uni-app miniapps, Turbo monorepo scripts.

### Task 1: Add shared shell and stats components

**Files:**
- Create: `miniapps/shared/components/MiniAppShell.vue`
- Create: `miniapps/shared/components/MiniAppOperationStats.vue`
- Create: `miniapps/shared/components/MiniAppTabStats.vue`
- Modify: `miniapps/shared/components/index.ts`

**Step 1: Write component contracts and pass-through behavior**
- `MiniAppShell` must:
  - accept `config`, `state`, `t`, optional `sidebarTitle/sidebarItems`, optional `fireworksActive`, optional `statusMessage`.
  - wrap `#content` slot in `ErrorBoundary` with `fallbackMessage`, `onBoundaryError`, and `onBoundaryRetry` pass-through props.
  - expose `#operation`, `#tab-stats`, and `#tab-docs` slots as pass-through.
  - emit `tab-change` from internal `MiniAppTemplate`.
- Stats wrappers must render the existing `NeoCard` + `NeoStats` pattern with configurable variant/class.

**Step 2: Implement minimal wrappers**
- Keep wrappers simple, no new business logic.
- Preserve all current behaviors through prop/slot forwarding.

**Step 3: Export new components**
- Add named exports in `miniapps/shared/components/index.ts`.

**Step 4: Commit checkpoint**
- `git add miniapps/shared/components`
- `git commit -m "refactor(shared): add miniapp shell and stats wrappers"`

### Task 2: Migrate index pages to `MiniAppShell`

**Files:**
- Modify: `miniapps/*/src/pages/index/index.vue` (subset that use the repeated `MiniAppTemplate + ErrorBoundary` scaffold)

**Step 1: Replace top-level scaffold**
- Swap `<MiniAppTemplate ...>` with `<MiniAppShell ...>` where compatible.
- Remove local inline `ErrorBoundary` wrappers from `#content` slots in migrated files.
- Preserve existing retry/error handlers and messages by mapping to shell props.

**Step 2: Preserve operation/stats/docs slot behavior**
- Ensure `#operation`, `#tab-stats`, and any other tabs still render exactly as before.

**Step 3: Keep non-conforming pages untouched**
- If a page has unique boundary behavior incompatible with shell props, skip it for this pass.

**Step 4: Commit checkpoint**
- `git add miniapps/*/src/pages/index/index.vue`
- `git commit -m "refactor(miniapps): adopt MiniAppShell for shared index scaffold"`

### Task 3: Migrate repeated stats markup to shared wrappers

**Files:**
- Modify: `miniapps/*/src/pages/index/index.vue` where `#tab-stats` or `#operation` uses repeated `<NeoCard><NeoStats/></NeoCard>`

**Step 1: Replace repeated patterns**
- Use `MiniAppTabStats` for stats tab cards.
- Use `MiniAppOperationStats` for operation panel stats cards.

**Step 2: Remove redundant imports**
- Drop per-page `NeoCard`/`NeoStats` imports when only used for replaced wrapper markup.

**Step 3: Commit checkpoint**
- `git add miniapps/*/src/pages/index/index.vue`
- `git commit -m "refactor(miniapps): use shared stats wrapper components"`

### Task 4: Validation and documentation updates

**Files:**
- Modify: `scripts/validate-miniapps.mjs` (only if needed for shell adoption checks)
- Modify: `docs/MINIAPPS_INTEGRATION.md`

**Step 1: Validate contract checks**
- Keep existing checks for `MiniAppTemplate` compatibility.
- If shell adoption is broad, extend checks to accept `MiniAppShell` as valid shared-template usage.

**Step 2: Document new defaults**
- Add a short section for `MiniAppShell` + stats wrappers in integration docs.

**Step 3: Run verification commands**
- `node scripts/validate-miniapps.mjs`
- `pnpm turbo typecheck --filter='./miniapps/*'`
- `pnpm turbo build:h5 --filter='./miniapps/*'`

**Step 4: Final commit checkpoint**
- `git add docs/MINIAPPS_INTEGRATION.md scripts/validate-miniapps.mjs`
- `git commit -m "docs: document miniapp shell and stats reuse conventions"`
