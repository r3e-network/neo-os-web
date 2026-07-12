# Neo Multisig

Neo Multisig is a production-oriented threshold-approval interface for the deployed `MiniAppMultisig` custody contract.

> This app does **not** construct a native Neo multisig address or combine native multisig witnesses. Funds are held by one canonical contract address; each vault is isolated by its on-chain vault ID. Signers approve requests by submitting contract calls from their own wallets.

## User workflow

1. Connect a Neo N3 wallet and create a vault with 2–16 distinct signer addresses and a 1-of-N through N-of-N threshold. The creator must be included as a signer.
2. Deposit whole-unit NEO or decimal GAS into the loaded vault.
3. Create a spend request for a recipient, asset, amount, and optional 160-character memo.
4. Share the request ID. Each listed signer can approve once; any listed signer can cancel a pending request.
5. At the threshold, the contract transfers the funds automatically. If another pending request spent the shared balance first, the request is auto-cancelled as unfunded.

The first screen is a custody workbench, not a generic parameter form. It uses the app's real vault/proposal artwork, official NEO/GAS token icons, a signer roster, verified balances, approval progress, and one context-sensitive primary action. Detailed inputs stay in the secondary tools drawer.

## Transaction correctness

- Every read and write is pinned to the canonical network-specific contract hash.
- A wallet/launch-network mismatch blocks contract access.
- Writes are not reported as successful from a relay result or transaction ID alone.
- Each operation waits for its exact contract event and then reads the affected vault/request back from chain.
- Pending transaction context is persisted locally and can be recovered after a timeout or reload.
- A `FAULT` application log clears the pending operation without creating a success state.
- Duplicate approval is blocked by a fresh `hasApproved` chain read immediately before submission.
- IDs, token base units, and balances remain integer-safe; display conversion does not pass through JavaScript floating-point numbers.

## Deployed contract

| Network | Contract |
| --- | --- |
| Neo N3 MainNet | `0xa361cdc792e97c4d8ddf42048cf48f3283ea7178` |
| Neo N3 TestNet | `0xa361cdc792e97c4d8ddf42048cf48f3283ea7178` |

The live ABI exposes `createVault`, `createRequest`, `approve`, `cancel`, `balanceOf`, `getVault`, `getRequest`, `hasApproved`, `lastVaultId`, `lastRequestId`, and `onNEP17Payment`. The UI consumes the corresponding vault, deposit, request, approval, execution, cancellation, and unfunded events.

Read [TESTNET_STATUS.md](./TESTNET_STATUS.md) for the current verification boundary.

## Development

```bash
npm run test --workspace apps/neo-multisig
npm run build --workspace apps/neo-multisig
```

The app is a host-native React play area built with Vite and the shared miniapp design system.
