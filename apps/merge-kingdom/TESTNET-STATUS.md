# Merge Kingdom testnet status

Checked read-only against Neo N3 testnet RPC on 2026-07-11. No transaction was sent and no contract was deployed or updated.

## Live deployment

- Script hash: `0x3fa9eb983a49ee181748778286a704f1ad55ff75`
- Manifest name: `MiniAppMergeKingdom`
- Update counter: `0`
- Deployed NEF checksum: `4260724675`
- Local `contracts/build/MiniAppMergeKingdom.nef` checksum: `4260724675`
- The deployed `getConfig` values match the frontend's 0.02 / 0.10 / 0.20 GAS entry tiers, 0.10 / 0.50 / 1.00 GAS rewards, 3 / 5 / 10 minute limits, 30 / 60 / 120 second minimum solve times, and 64 / 256 / 1024 targets.
- Configured Morpheus oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52`

## Why new paid entries remain closed

- `freePool`: `0` base units
- `reservedPool`: `0` base units
- `lastGameId`: `0`
- Morpheus `isAllowedCallback(mergeKingdom)`: `false`
- Morpheus fee credit for Merge Kingdom: `0` base units
- Morpheus request fee: `1,000,000` base units (0.01 GAS)

The published app therefore keeps `supportsGameFi: false`, exposes no paid operation, and makes no reward claim. The historical GameFi implementation remains available for exact active-game readback, settlement recovery, expiry release, and credit withdrawal after the live dependencies are funded and verified.

## Published playable path

- Phaser 3 resource-driven local merge game
- Web Crypto spawn selection with unbiased rejection sampling
- Device-local active-board recovery, best building, clear count, and recent results
- Pointer drag, tap-to-select, keyboard controls, sound cues, and reduced-motion handling
- No wallet, payment, oracle request, or chain write in guest mode

## Activation checklist

- [x] Deployed contract and local build checksum match.
- [x] Deployed contract configuration matches the frontend rules.
- [x] Guest game is production-playable without a wallet.
- [ ] Fund a reward pool that covers every advertised tier.
- [ ] Allowlist the deployed callback contract in Morpheus.
- [ ] Fund the contract's Morpheus request-fee credit.
- [ ] Run start, move replay, finalize callback, exact `getGame` readback, expiry, and withdrawal on testnet.
- [ ] Enable GameFi manifests only after the entire wallet flow passes.
