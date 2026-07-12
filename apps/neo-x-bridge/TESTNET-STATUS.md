# Neo X Bridge testnet status

Checked: 2026-07-12

This compatibility document now defers to [NETWORK_STATUS.md](./NETWORK_STATUS.md), which verifies both MainNet and TestNet route identities and records the shared product boundary.

TestNet facts used by the app:

- Neo N3 TestNet T5: network magic `894710606`, RPC `https://api.n3index.dev/testnet`.
- Neo X TestNet T4: chain ID `12227332` (`0xba9304`), RPC `https://neoxt4seed1.ngd.network`.
- Official TestNet bridge: `https://testnet.bridge.banelabs.org/`.
- The launch network selects the TestNet workspace; wallet readiness is verified independently when the user connects the source wallet.
- No miniapp-owned contract is declared or deployed.
- Live limits, fees, approvals, signing, submission, and destination confirmation remain on the official bridge.
