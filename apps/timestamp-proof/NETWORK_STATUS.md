# Timestamp Proof network status

Last reviewed: 2026-07-12

## Supported networks

- Neo N3 Mainnet
- Neo N3 Testnet

The app has no dedicated deployed contract. Its optional public anchor invokes the official native GAS contract at `0xd2a4cff31913016155e38e474a2c06d08be276cf`, which is stable across Neo N3 Mainnet and Testnet.

## Write binding

Before the wallet invocation, the app requires `app.chain.detectNetwork()` to resolve exactly to `neo-n3-mainnet` or `neo-n3-testnet`. It does not infer the signing network from URL or launch defaults when live wallet detection is generic, unsupported, or unavailable.

The submitted call is:

- contract: native GAS
- operation: `transfer`
- from: connected wallet
- to: the same connected wallet
- amount: `0`
- data: `timestamp-proof:<64-hex SHA-256 digest>`

The two native `Hash160` arguments are the canonical script hash derived from
the connected Neo N3 address. If the observable wallet changes while the
network is being resolved, the app stops before persisting a reservation or
opening the invoke path.

Normal Neo network fees still apply even though the transfer amount is zero.

## Read binding

Receipt verification uses the exact network recorded in the portable reference or selected by the user. The verifier calls `getapplicationlog` and `getrawtransaction` on that network and never falls back to another network after a failed read.

The chain result is classified as:

- `confirmed`: the selected method resolves exactly — either HALT + zero-GAS self-transfer + digest marker, or immutable tenant Notary state with matching digest and submitter — and a chain time is available;
- `pending`: the transaction is genuinely unknown/not indexed yet;
- `fault`: the VM execution is `FAULT`;
- `mismatch`: the execution, wallet, GAS event, or digest binding is wrong;
- `unreachable`: RPC/response/block-time data is unavailable or incomplete.

An invalid expected wallet never disables wallet binding. Malformed event hash
slots are rejected, even when the malformed `from` and `to` strings happen to
match. A stored anchored claim is rechecked after every reload instead of being
trusted from local storage alone.

## Live validation boundary

No funded write or live wallet signing was performed in this code-only pass. Mainnet/Testnet support is based on exact runtime binding and deterministic tests; it still requires a release-owner TestNet transaction and receipt check before production sign-off.

The production manifest currently has no PlatformSocial binding. Notary support
is source-ready only and is not live deployment, registration, or transaction
evidence.
