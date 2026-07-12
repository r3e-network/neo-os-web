# AA Permissions

AA Permissions is a live permission-rotation workspace for the deployed
`UnifiedSmartWalletV3` AA Core. It treats the account binding as the primary
resource and keeps raw hashes and verifier bytes in secondary settings.

## Product flow

1. Select one network-scoped AA account ID and inspect its complete live record.
2. Connect the wallet whose script hash exactly matches the freshly read backup owner.
3. Select the verifier or hook lane and verify the target contract independently.
4. If the lane is empty, install its first binding immediately.
5. If the lane already has a binding, propose a replacement, wait 24 hours, then confirm or cancel it.

The first-install exception is contract behavior, not a UI shortcut:
`updateVerifier` and `updateHook` emit their confirmed event immediately when
the current lane is zero. Replacements emit an initiated event and create a
timelocked proposal.

## Truth and recovery rules

- Mainnet and Testnet use different canonical AA Core hashes; launch network,
  wallet network, AA Core, account ID, and backup owner must all agree.
- All seven permission reads must HALT and decode consistently. A failed or
  partial read clears the visible binding instead of displaying empty/zero data.
- A transaction ID means broadcast, not success. Confirmation requires the
  operation's exact event plus authoritative account readback; first install
  may be proven by the exact target state because it has no pending phase.
- The exact transaction binding is persisted at broadcast time. Reload and
  retry only check the saved event/state and never resubmit the wallet action.
- A VM FAULT proven by `getapplicationlog` clears the failed journal; an
  unavailable transaction log remains pending rather than being guessed.
- Wallet writes are disabled when local recovery storage cannot be verified.

## Runtime boundary

Read-only inspection works without a wallet. Writes require a registered
backup-owner wallet and the exact launch network. This release performed no
wallet signing, funded transaction, deployment, or contract update.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md),
[PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), and
[ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for dated evidence and boundaries.
