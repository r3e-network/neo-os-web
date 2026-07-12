# Screw Sort network status

Screw Sort `1.1.0` is deliberately a wallet-free local game.

- Runtime reads: none from Neo RPC, contracts, oracle services, balances, or wallets.
- Runtime writes: none to Neo N3, Neo X, a payment service, or an oracle.
- Wallet connection: not requested.
- Contract addresses: none.
- Transaction permissions: disabled.
- GameFi rewards: disabled and not simulated.
- Local persistence: namespaced device storage with in-memory fallback, exact write/read-back verification, and a visible unavailable message when storage throws or silently declines a write.
- Optional practice leaderboard: off-chain only; failure never changes the authoritative local win.

`default_network` in `neo-manifest.json` is platform catalog metadata, not an active gameplay dependency. The runtime must remain fully playable when offline.

Any future GameFi lane is a separate product milestone. It requires a real deployed contract and funded pool, network pinning, wallet review, durable no-replay pending state, exact transaction/event/readback reconciliation, failed reads shown as unavailable, and testnet end-to-end evidence before manifest capabilities are enabled.
