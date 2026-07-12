# GasBox production status

Updated: 2026-07-12

## Implemented

- Resource-led capsule-machine stage with real machine/capsule artwork
- Official NEO/GAS token art and exact wallet balances
- 1-based V2 prize indexing
- Exact base-unit pull price, revenue, total pool, reserved pool, free pool and maximum prize
- Pull eligibility based on free pool rather than total pool
- GAS prepay reuse and explicit unused-credit withdrawal
- Creator revenue/free-bankroll recovery, with pool top-up implemented for a compatible deployment
- Two-step fixed-beacon commit/reveal flow implemented for a compatible deployment, with real transaction-driven animation
- Network/contract/read-surface checks before play
- Explicit catalog loading, empty and error states
- Network/contract/wallet-scoped pending reveal journal and read-only reload recovery
- Responsive drawer hierarchy and reduced-motion behavior
- Compatibility gate that keeps the known older live deployment browse/recovery-only

## Intentionally not claimed

- VRF-grade randomness
- NFT prizes
- Machine trading
- Keeper or AA automation
- A live machine catalog: both observed networks currently report zero machines

## Paid-write gate

The current MainNet/TestNet hash is not the local fixed-beacon artifact and cannot be upgraded in place through its exposed ABI. The app therefore allows read-only browsing plus necessary recovery (`settle` for an existing pending bet, unused credit withdrawal, revenue withdrawal, free-bankroll withdrawal and deactivation), while blocking new economic exposure.

Resume only after a new fixed-beacon deployment is verified and the registry/manifest hashes are updated.

## Operational boundary

This production-polish lane performed read-only network verification. It did not sign, broadcast, deploy or update a contract.

## Verification evidence

- Five focused logic, launch, integration, PlayArea, and end-to-end files: 60/60 tests passed.
- TypeScript, scoped ESLint, and the GasBox product-structure gate passed.
- Production build passed with 1,856 transformed modules. The app chunk is
  244.74 kB raw / 74.44 kB gzip and the UI vendor is 31.16 kB / 11.17 kB.
  Importing the game stage directly removed the unrelated 136.83 kB UI CSS
  vendor payload.
- Every emitted HTML, JavaScript, CSS, manifest, logo, banner, machine, capsule,
  and cutout resource returned HTTP 200 from the local production preview.
