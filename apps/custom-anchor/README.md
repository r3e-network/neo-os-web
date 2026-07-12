# Custom Anchor

Custom Anchor is the user-facing governance and yield surface for the shared `PlatformAnchor` contract. It keeps staking as the single primary action, while redeeming, claiming, discovery, registration, credit recovery, and raw setup parameters stay secondary.

## Product flow

- Select a registered anchor and a whole-NEO amount.
- Review the 21-agent route and stake from the primary action.
- Redeem NEO or claim GAS from secondary actions.
- Create a new anchor from the advanced drawer. Registration is a durable four-stage workflow: fee credit, anchor registration, AA account registration, then 21-agent binding.
- Recover a broadcast stage after refresh. The app checks VM HALT/FAULT, the exact expected event, and exact contract readback before advancing.

The app never treats a wallet relay response as final chain success. Unknown transaction state remains pending and is never automatically replayed.

## Local verification

```bash
npm exec vitest -- run test/custom-anchor.setup.test.ts test/custom-anchor.production.test.ts test/custom-anchor.integration.test.tsx test/custom-anchor.playarea.test.tsx --maxWorkers=1 --testTimeout=20000
npx tsc -p apps/custom-anchor/tsconfig.json --noEmit --incremental false
npx eslint apps/custom-anchor/src apps/shared/test/custom-anchor.setup.test.ts apps/shared/test/custom-anchor.production.test.ts apps/shared/test/custom-anchor.integration.test.tsx apps/shared/test/custom-anchor.playarea.test.tsx
npm --prefix apps/custom-anchor run build
```

No private keys, candidate secrets, or wallet signatures are stored. Candidate public keys and deterministic agent account identifiers are public registration intent data.
