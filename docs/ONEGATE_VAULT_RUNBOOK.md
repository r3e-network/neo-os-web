# OneGate Vault Runbook

Last updated: 2026-05-11

OneGate Vault is the production OneGate dApp registered as OneGate app id `23`.
The miniapp slug is `gas-lucky-pool`, and the platform app id is
`miniapp-gas-lucky-pool`.

## Production Entry Points

- OneGate app: `https://onegate.space/app/23`
- dApp runtime: `https://neomini.app/miniapps/gas-lucky-pool/index.html`
- Production deployment verified: `dpl_8XYZHAgg8oMUG79PmMwP3jMRcoFS`
- Production alias: `https://neomini.app`

The OneGate QR payload should stay short and only carry the fields needed for a
claim:

```text
https://onegate.space/app/23?network=testnet&pool=pool-001&key=<claim-key>
https://onegate.space/app/23?network=mainnet&pool=pool-001&key=<claim-key>
```

Do not add redundant `id`, `operation`, duplicate app ids, or platform-only
query fields to QR URLs.

## dApp Shell Behavior

When the app is opened from OneGate or directly, it renders as a pure dApp:

- no miniapp platform back button
- no miniapp platform shell
- no sidebar or platform navigation
- one primary `Claim Reward` action when a key is present

When opened with `source=platform`, it intentionally keeps the miniapp platform
shell for normal platform browsing.

## Language Behavior

Supported languages are declared in both the miniapp catalog and the OneGate
catalog:

```json
["en", "zh", "ja"]
```

Runtime selection order:

1. Explicit query language, for example `lang=ja`.
2. OneGate/system browser language from `navigator.languages`.
3. English fallback when the language is unsupported.

Verified behavior:

- `ja-JP` renders Japanese, including `報酬を受け取る`.
- `zh-CN` and `zh-TW` render Chinese, including `领取奖励`.
- `en-US` renders English, including `Claim Reward`.
- Unsupported locales such as `fr-FR` and `ko-KR` fall back to English.

## Claim Security Model

The frontend never decides the reward amount and never holds the payout wallet.
The server-side claim flow validates:

- hashed claim key with server-only pepper
- network scope, so the same key can be used once on testnet and once on mainnet
- pool id and OneGate app id
- app id
- single-use key semantics
- wallet binding
- random reward amount in the configured 1-50 GAS range
- tx-proxy GAS transfer result

Re-clicking the same key with the same wallet is idempotent and returns the same
transaction result. Replaying the same key with a different wallet is rejected.

## Latest Testnet Full-Flow Validation

Validation date: 2026-05-11

Consumed testnet key id: `ogv_003` from
`/Users/jinghuiliao/Desktop/onegate-vault-claim-keys-2026-05-09-testnet-id23.csv`.
The raw key is intentionally not recorded here.

Result:

- OneGate QR link returned HTTP 200.
- dApp runtime returned HTTP 200.
- dApp rendered pure standalone mode.
- `network=testnet`, `pool=pool-001`, and the claim key were passed into the dApp.
- Simulated OneGate testnet dAPI wallet connected.
- `Claim Reward` submitted a real testnet claim.
- Status endpoint returned `paid`.
- Final UI showed the congratulations state, reward amount, luck percentile, and
  tx hash.
- Mainnet status lookup for the same key returned 404, confirming network
  isolation.
- Same-wallet repeat submit returned the same tx and amount, confirming
  idempotency.
- Different-wallet replay returned HTTP 403.

Testnet payout:

```text
amount: 9.980943 GAS
tx_hash: 0x3fdf1ff444eea1eb51c3c924f5ec0669fdf7ef36eaa99a003fbf28c151a15044
vmstate: HALT
```

Screenshot artifact:

```text
output/playwright/onegate-vault-testnet-claim-final.png
```

## Verification Commands

Use these commands before claiming the flow is production-ready:

```bash
npx vitest run \
  test/i18n-locale.test.ts \
  test/gas-lucky-pool-copy.test.ts \
  test/gas-lucky-pool.playarea.test.tsx \
  test/miniapp-root.launch-params.test.ts \
  test/miniapp-root.runtime.test.ts \
  --config apps/shared/vitest.config.ts

npm run -s verify:miniapp-dapps
npm --prefix platform/host-app run -s build
```

For live checks, verify:

- `https://neomini.app/api/health` returns HTTP 200.
- `https://neomini.app/miniapps/onegate-catalog.json` contains app id `23`.
- OneGate id `23` points to
  `https://neomini.app/miniapps/gas-lucky-pool/index.html`.
- Testnet and mainnet Vault URLs both open, but claim state remains
  network-scoped.

## Seeding Claim Keys

Use `scripts/onegate-vault/seed-claim-keys.mjs` to normalize and seed claim
keys. The script stores only hashed keys and requires server-side Supabase and
pepper environment variables. Never commit raw generated claim keys.

Dry run:

```bash
node scripts/onegate-vault/seed-claim-keys.mjs \
  --csv <csv-file> \
  --network testnet \
  --pool-id pool-001 \
  --onegate-app-id 23
```

Execute only when the target CSV, network, and pool are correct:

```bash
node scripts/onegate-vault/seed-claim-keys.mjs \
  --csv <csv-file> \
  --network testnet \
  --pool-id pool-001 \
  --onegate-app-id 23 \
  --execute
```

