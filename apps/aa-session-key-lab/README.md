# AA Session Key Lab

A designed session-permission workspace for Neo Abstract Accounts. The primary surface is a live permission object — account, owner authority, public key, contract/method scope, expiry, and allowance — rather than a wall of contract parameters.

## Product journey

1. Enter an existing registered `AccountId` as an exact 20-byte hash (or its
   Neo N-address) and inspect it on the launch network. The app does not derive
   a plausible-looking account from a demo seed.
2. Read its backup owner and verifier from the canonical `UnifiedSmartWalletV3` AA Core.
3. Require the connected wallet to match that on-chain owner and the account verifier to match the canonical SessionKeyVerifier.
4. Generate a local P-256 session key. The private key is never persisted and stays hidden until the user explicitly reveals or copies it.
5. Choose one contract, one explicit method, an expiry window, and — on mainnet only — a GAS allowance.
6. Submit through `aaCore.callVerifier("setSessionKey", ...)`.
7. Show the permission as active only after the exact object is read back from chain.
8. Revoke through a two-step confirmation and show completion only after the verifier returns no session record.

Raw account IDs, hashes, timestamps, contract addresses, and sponsorship controls live in the secondary details drawer.

## Network behavior

- Mainnet SessionKeyVerifier uses the current 7-argument ABI and exposes `getSessionKeyMetadata` and `getSpentAmount`.
- Testnet is a frozen 5-argument verifier. It does not expose or enforce a spending allowance; the UI says so and never displays a fake zero/unlimited allowance.
- Expiry is edited as Unix seconds for people, then submitted as milliseconds because the deployed verifier stores and compares Neo `Runtime.Time`.
- Every write re-detects the wallet network and re-reads the account owner/verifier before opening the wallet request.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for pinned contracts and live ABI evidence.

## Transaction recovery

A versioned local journal records the exact network, AA Core, verifier, account, owner, intended operation, expected permission object, and transaction ID. A refresh only performs readback; it never resubmits. A broadcast transaction remains pending until exact configure readback or revoke absence is observed. A VM `FAULT` proven by `getapplicationlog` clears the failed journal; an unavailable transaction log remains recoverable rather than being guessed.

## Verification

From the repository root:

```bash
./node_modules/.bin/vitest run --config apps/shared/vitest.config.ts \
  apps/shared/test/aa-session-key-lab.logic.test.ts \
  apps/shared/test/aa-session-key-lab.playarea.test.tsx \
  apps/shared/test/aa-session-key-lab.integration.test.tsx \
  --pool=forks --maxWorkers=1 --no-file-parallelism

cd apps/aa-session-key-lab
../../node_modules/.bin/vitest run src/utils/sessionKeyDecode.test.ts \
  --config vite.config.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Browser automation, deployment, signing, and funded transactions are intentionally outside this scoped local verification lane.
