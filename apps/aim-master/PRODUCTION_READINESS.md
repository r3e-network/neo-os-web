# Aim Master production readiness

Last reviewed: 2026-07-11 (Neo N3 testnet)

## Current release surface

- Guest mode is the only public mode. It is local, free, walletless, and uses
  Web Crypto for each run's target seed.
- Verified GameFi starts are fail-closed in the source manifest, catalog
  manifest, permissions, and runtime (`NEW_PAID_RUNS_ENABLED = false`).
- Existing GameFi recovery code remains identity-bound for historical sessions,
  but no new economic action is exposed.

## Read-only deployment evidence

- Contract: `0xed26866fb59219db8743c7673df098f363bac9ec`
- Name/version: `MiniAppAimMaster` / `3.0.0`
- On-chain NEF checksum: `422251087`
- Local reviewed NEF checksum: `422251087`
- Local NEF SHA-256:
  `b23f610d7c25a93d0e4a4d076afc3dd2767bd575d6fe31589588e2218fb1dafc`
- Oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- Network magic: `894710606`
- Paused: `false`
- Daily cap: `8`
- Free / reserved / total reward pool: `0 / 0 / 0 GAS`
- Last game id: `0`
- Contract configuration matches the frontend difficulty table:
  entries `0.02 / 0.10 / 0.20 GAS`, rewards `0.10 / 0.50 / 1 GAS`,
  timers `60 / 90 / 120 s`, minimum solve times `10 / 20 / 30 s`, and
  accuracy targets `3 / 5 / 7`.
- Morpheus public and edge health endpoints were ready, and the contract's
  oracle binding matched the testnet registry.

These checks prove deployment identity and read-only configuration. They do
not prove a funded economic lifecycle. The empty pool makes a live start,
settlement callback, credit readback, and withdrawal impossible to validate.

## GameFi release gate

Do not enable verified GAS mode until all of the following are recorded against
the same checksum and engine hash:

1. Fund the reward pool with testnet GAS and confirm `PoolFunded` plus
   `freePool` readback.
2. Start each difficulty with an already connected wallet; match the exact
   `GameStarted` event or `activeGameOf` + `getGame` identity readback.
3. Open the Morpheus session and verify app id, engine hash, contract hash,
   player, difficulty, limits, minimum solve time, undo cap, and target.
4. Stream a real human input trail, reload mid-run, and replay the durable
   append-only operation log.
5. Prove solved, expired, callback-pending, retry, and grace-release paths.
6. Withdraw credit and match the exact `CreditWithdrawn(account, amount)` event
   or a zero-credit readback before showing success.
7. Re-run the app tests, shared global guards, TypeScript, ESLint, build, and
   live validation. Only then flip the public manifest and runtime gates in the
   same reviewed change.

## Asset provenance

The range backdrop, target, reticle, banner, and logo are project-owned
generated assets documented in `public/art/ATTRIBUTION.md`. No source code or
art was copied from `IcedSoul/minigame-everyday`: the repository has no formal
root license file and its README's art guidance does not provide sufficient
asset-level provenance for direct reuse.
