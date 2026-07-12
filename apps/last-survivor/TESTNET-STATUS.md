# Last Survivor production status — 2026-07-12

## Shipping now

- Phaser 3 free arena with a warm, high-contrast resource-led scene.
- Local bot-rival last-seat loop: unpredictable takeovers, diminishing time returns, small-pack score advantage, clutch reclaim bonus, win/loss, instant restart, and best-effort off-chain leaderboard.
- Pointer, touch, keyboard mirror controls, sound cues, leader-change motion, and reduced-motion fallback.
- New paid rounds are hidden in the launcher, public manifest, and runtime action guard. No wallet prompt or chain write occurs in free mode.
- GameFi reads now distinguish unavailable data from a verified zero/empty value. Round, key, credit, quote, and history availability are surfaced independently.
- Wallet GAS has its own explicit availability state; a failed wallet read is never displayed as a confirmed `0.00 GAS` balance.
- Every paid write (credit deposit, key purchase, settlement, and withdrawal) requires a canonical wallet/network/contract binding and a durable local recovery preflight before broadcast.
- A submitted write is locked by exact transaction id, network, contract, wallet, and intent. The post-broadcast record is retained in session memory before durable persistence, so a storage failure still blocks replay and preserves the exact transaction for the current session.
- The lock clears only after the expected event and an authoritative contract readback agree. Application-log recovery distinguishes VM `FAULT`, indexing delay, and `HALT` without the expected event; the drawer provides one explicit recovery check and never replays the write.

## TestNet contract evidence

- Contract: `0xff122a6cf7f22a88d059d61a9d9c07e84a2b56b9`
- Name/version: `MiniAppLastSurvivor` v1.1.0
- Local NEF checksum: `2859468900`
- Live TestNet NEF checksum: `2859468900`
- Local NEF SHA-256: `1d1a2ea8c05cbf05cf3994a9053768703409c036b75990ab47971e64f5cb43e1`
- Live read probes on 2026-07-11: `getCurrentRound` HALT, round 4 fresh/active; `currentKeyCost(1)` HALT at `10_000_000` base units.
- The two-wallet contract harness passed buy A, buy B, expiry, permissionless settlement, pull-payment winner credit, both withdrawals, and fresh-round rollover on 2026-07-10. See `docs/reports/last-survivor-testnet-live-2026-07-10.md`.

## Paid activation gate

The contract is proven, and the refreshed frontend now has focused automated coverage for strict reads, canonical binding, durable journaling, duplicate prevention, exact events, authoritative readback, and friendly recovery. It is not yet advertised as GameFi because activation still requires one current end-to-end wallet/browser matrix against this exact build:

1. connect without accidental buy;
2. atomic shortfall transfer + `buyKeys` in one wallet transaction;
3. exact `KeysBought` recovery across refresh and round rollover;
4. duplicate-submit lock during indexer lag;
5. expiry + permissionless `settle` + exact `RoundSettled` readback;
6. winner/prepaid `withdraw` + exact `CreditWithdrawn` readback;
7. insufficient-GAS, wallet rejection, RPC outage, VM FAULT, stale state, and reconnect recovery;
8. desktop and mobile touch/keyboard presentation.

This 2026-07-12 code lane did not sign, fund, deploy, or send a live transaction, and it did not run browser automation. Those checks remain explicit activation evidence rather than inferred success.

MainNet `0x8e1e432e966357de8d7642564b744d3274a81bd0` is v1.0 and has a different NEF checksum. Its reads currently HALT, but no new MainNet write is enabled or treated as equivalent to the verified TestNet generation.
