# Neo Convert network status

Review date: 2026-07-11

## Runtime boundary

- Neo Convert has no MiniApp contract, performs no invocation, and never asks
  the wallet to sign or submit a transaction.
- Key generation, WIF/private/public-key conversion, Neo N3 address decoding,
  and NeoVM script disassembly run in the browser process.
- Neo N3 address version `0x35` and key derivation are the same for mainnet and
  testnet. Conversion output is therefore not bound to a deployed app contract.
- The manifest correctly declares both `neo-n3-mainnet` and
  `neo-n3-testnet`, an empty `contracts` map, `transactions: false`, and only
  the read-blockchain permission required by the optional balance snapshot.
- No static `stateSource` is declared: exact balance reads follow the active
  wallet/network service, so a fixed endpoint could misdescribe the other
  supported network.

## Optional wallet balance snapshot

- A connected wallet is used only to identify the address whose NEO and GAS
  balances are read.
- Each refresh captures the wallet address, reads raw NEO/GAS base units for
  that address, formats NEO with 0 decimals and GAS with up to 8 decimals, and
  discards the response if the wallet address changed while the read was in
  flight.
- Balance observers are only invalidation signals; displayed values are
  re-read from raw base units so number-backed observer values cannot introduce
  display rounding.
- Disconnect or a direct switch between connected addresses clears the old
  snapshot immediately and invalidates stale in-flight loads.

## Not applicable

Contract binding, transaction event confirmation, contract-state readback,
pending-operation persistence, wallet signing, and transaction recovery do not
apply because this MiniApp has no write path. Inventing those behaviors would
misrepresent the product.

No deployment or funded mainnet/testnet transaction was performed in this
production pass.
