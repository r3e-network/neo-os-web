# Developer Tipping production status

Status: production implementation complete for the scoped MiniApp frontend on 2026-07-12. Host synchronization and funded network actions were intentionally not performed.

## Product experience

- The primary surface is a warm, bright developer support desk built on the shared social `PlayStage`.
- The repository-owned `support-board-stage.webp` scene is both the in-app focal resource and the selected catalog/Open Graph cover.
- The main path is recipient first: select a registered builder, choose a GAS preset or exact custom amount, choose wallet-address visibility, then confirm one wallet action.
- Direct developer ID, developer registration, claimable-tip withdrawal, unused-credit withdrawal, and recent activity remain in four secondary drawer tabs.
- Walletless visitors can browse the verified registry and activity. Payment controls remain unavailable until the connected wallet snapshot is current.
- Empty registry, empty history, partial history, runtime failure, wallet-read failure, pending receipt, readback lag, `FAULT`, stranded credit, and stale receipt states have distinct copy and recovery actions.

## Business-flow guarantees

- GAS values remain Fixed8 integers through submission, journaling, event comparison, state readback, and display formatting.
- Existing tip credit is reused first. Only the exact shortfall is deposited; the previous full-amount redeposit behavior is covered by a deterministic regression test.
- Every write is bound to the account, Neo N3 network, contract hash, and input snapshot observed before broadcast. The binding is rechecked after asynchronous reads.
- Tip, developer registration, developer-tip withdrawal, and unused-credit withdrawal all persist exact transaction journals through `onTransactionSent`; the two-step tip path also journals `onPaymentSent`.
- Only exact `0x`-prefixed 64-byte transaction IDs are accepted. Conflicting IDs preserve the first saved receipt.
- A write is confirmed only when its expected contract event and authoritative state readback agree. HALT without the exact event remains pending; exact `FAULT` is terminal.
- Pending operations block every other wallet write. A receipt older than 24 hours remains locked instead of silently enabling a duplicate action.
- Registry, activity, and wallet refreshes use generation/account checks so a slow old-wallet response cannot overwrite the current wallet state.
- A confirmed transaction remains confirmed even if the follow-up board refresh is temporarily unavailable.
- Receipts older than 24 hours remain locked but are still actively reconciled;
  a late exact event or FAULT can now resolve them instead of leaving the user
  in a permanent expired state.
- A blocking receipt is promoted back into the recovery guard when the primary
  pending key is unavailable. Recovery cleanup verifies durable deletion; if
  deletion fails, the confirmed transaction stays visible and new writes stay
  blocked until another receipt check clears it.
- Connect and wallet-write actions now exclude each other at the product action
  boundary. Malformed developer invariants are rejected, and developer totals
  render from exact Fixed8 base strings instead of rounded JavaScript numbers.
- Mint and warm-gold controls now match the selected support-board resource and
  app icon instead of retaining the unrelated pink default theme.

## Validation evidence

- App tests: `5` files, `22` tests passed.
- Dev Tipping PlayArea/setup, scoped i18n parity, locale, and official-token
  suites: `5` files, `21` tests passed.
- Dedicated frontend structure gate: `1/1` passed.
- MiniApp dApp support verification: `77/77` manifests checked with zero failures.
- TypeScript: `npx tsc -p tsconfig.json --noEmit` passed.
- ESLint: `npx eslint src` passed with zero warnings or errors.
- Production build: `1856` modules transformed; app entry `225.81 kB` (`68.22 kB` gzip); CSS `107.96 kB` (`19.17 kB` gzip).
- Static dist HTTP check: `16/16` files returned HTTP 200 with expected content types.
- The rebuilt dist is byte-identical to the host copy. The generated catalog
  remains `77/77` unique app IDs with exactly one Developer Tipping `1.1.0`
  entry using `support-board-stage.webp` as its cover.
- Local asset inspection accepted `support-board-stage.webp` and `logo.webp`; the dark legacy scene and generic chart banner remain unselected.
- Browser automation, screenshots, live RPC, wallet prompts, funded actions,
  and deployments were not used in this scoped pass.

## Remaining external acceptance

Run the funded TestNet smoke described in `NETWORK_STATUS.md` from an approved
wallet environment. The verified frontend bundle is already synchronized to
the host.
