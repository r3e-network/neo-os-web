# Frontend Specification

This document describes the **current** frontend surface of the Neo MiniApp
platform repository. It is not a product wishlist or future-state design deck.

## Scope

Frontend code owned here covers:

- `platform/host-app`: the public host shell, miniapp catalog, detail pages,
  launch pages, stats pages, and host-side API routes
- `platform/admin-console`: operational and admin UX
- `apps/*`: miniapp frontends loaded by the host
- shared frontend runtime code under `apps/shared/*`

Current production target is **Neo N3 only**.

## Current Host Stack

`platform/host-app` currently uses:

- Next.js `15.x`
- React `18`
- **Pages Router** rather than App Router
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- `@r3e/neo-js-sdk`
- Module Federation for selected miniapp entry loading
- Supabase-backed host APIs for stats, notifications, publish workflow, and auth-linked features

## Host Responsibilities

The host frontend is responsible for:

- catalog browsing and miniapp discovery
- featured / flagship presentation
- miniapp launch and embedding
- wallet-aware transaction prompting
- host-side proxy calls for Oracle / AA / relay / stats / notifications
- review / rating / comment surfaces
- admin publishing and definition preview tooling

The host frontend is **not** the Oracle runtime, AA runtime, or paymaster
runtime. Those remain external integrations.

## Current Route Surface

The main user-facing pages currently implemented under `platform/host-app/pages`
include:

- `/`
- `/home`
- `/miniapps`
- `/miniapps/[id]`
- `/launch/[id]`
- `/app/[id]`
- `/explorer`
- `/docs`
- `/developer`
- `/account`
- `/analytics`
- `/stats`
- `/leaderboard`
- `/secrets`

Operational/API routes currently implemented include:

- `/api/rpc/[fn]`
- `/api/rpc/relay`
- `/api/rpc/sponsor`
- `/api/aa/relay`
- `/api/morpheus/oracle/*`
- `/api/morpheus/confidential/*`
- `/api/morpheus/neodid/*`
- `/api/miniapps/*`
- `/api/cron/*`
- `/api/platform/stats`
- `/api/notifications/*`
- `/api/chain/health`

## MiniApp Runtime Model

The host supports two runtime patterns:

- `mf://...` Module Federation entrypoints
- hosted miniapp bundles referenced by manifest metadata

The host resolves the miniapp definition, loads the frontend, and injects the
platform runtime surface used by MiniApps.

## Payment And Transaction UX

The current frontend must support **two** payment models:

### 1. Direct prepaid contract flow

Used by the current flagship direct-flow apps such as:

- GASBOX
- FogPlay
- Red Envelope
- NeoPay
- Daily Check-in
- SelfLoan

User flow:

1. wallet signs a direct GAS or asset transfer to the target contract
2. the contract records prepaid credit in `OnNEP17Payment`
3. the frontend invokes the follow-up contract method

### 2. Current payment model

The current flagship payment architecture uses direct contract transfers and
contract-local prepaid credit. New MiniApps should follow that path.

## Featured Catalog Policy

The repository currently contains **52** miniapp manifests under `apps/*`.

The current flagship 7 shown as primary market-facing apps are:

- `miniapp-self-loan`
- `miniapp-redenvelope`
- `miniapp-fogplay`
- `miniapp-dailycheckin`
- `miniapp-last-survivor`
- `miniapp-neo-pay`
- `miniapp-gasbox`

The current host homepage also surfaces a dedicated Account & Oracle Tools strip
for:

- `miniapp-aa-account-lab`
- `miniapp-aa-permissions-lab`
- `miniapp-aa-market-hub` (interactive trustless escrow market UI)
- `miniapp-aa-relay-console`
- `miniapp-aa-session-key-lab`
- `miniapp-oracle-price-console`
- `miniapp-oracle-seal-console` (local sealing + `encrypted_*_ref` preparation)
- `miniapp-oracle-neodid-console`
- `miniapp-oracle-http-console`
- `miniapp-oracle-compute-lab`
- `miniapp-oracle-vrf-console`
- `miniapp-neo-x-bridge`
- `miniapp-flamingo-swap`
- `miniapp-flamingo-lend`
- `miniapp-flamingo-earn`
- `miniapp-flamingo-analytics`
- `miniapp-flamingo-action-center`

These newer integration miniapps are **launcher / adapter surfaces**:

- they intentionally do not reimplement third-party protocol logic
- they provide curated discovery, official launch URLs, and wallet/network guidance
- bridge execution and Flamingo protocol execution remain on the official third-party surfaces

Current flagship payment matrix:

- Direct prepaid GAS: FogPlay, Red Envelope, Daily Check-in, Self Loan, NeoPay
- Direct prepaid GAS with `receiptId=0` ABI placeholder: LastSurvivor buy flow, GASBOX spin flow

When there is any conflict between older screenshots, older docs, and runtime
behavior, the manifest + host definitions + live validation report win.

## Source Of Truth Files

For frontend-visible app metadata and routing, prefer:

- `apps/*/neo-manifest.json`
- `platform/host-app/public/miniapp-definitions/*.json`
- `apps/shared/constants/rpc.ts`
- `deploy/scripts/live_validate_flagship_user_flows.js`

## Current Non-Goals

The frontend currently does **not** promise:

- full App Router migration
- universal AA execution for every miniapp
- dark-pattern-heavy gamification or speculative catalog counts
- broad “future roadmap” features that are not already present in code

## Maintenance Rule

If a host page, API route, miniapp definition, or manifest is removed or added,
this file should be updated to match the actual codebase rather than preserving
older planning language.
