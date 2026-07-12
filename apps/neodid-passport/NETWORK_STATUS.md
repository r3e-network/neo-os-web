# NeoDID Passport network status

Repository registry snapshot reviewed: **2026-07-12**

This pass inspected the generated Morpheus registry consumed by the app; it did
not make a live network request. The app performs the following read-only checks
when a user creates a review:

| Network | Repository configuration | Runtime product behavior |
| --- | --- | --- |
| Neo N3 mainnet | Magic `860833102`; NeoDIDRegistry `0xb81f31ea81e279793b30411b82c2e82078b63105` | Requires the resolver-declared anchor to match, then reads network magic and contract state and accepts only manifest name `NeoDIDRegistry`. |
| Neo N3 testnet | Magic `894710606`; NeoDID registry address is empty | Records `no-network-deployment` and does not promote resolver output to registry evidence. |

The same-origin resolver can return a syntactically valid DID document without
proving subject-to-wallet binding. A wallet signature is recorded as an opaque
wallet-returned artifact because the host does not expose each adapter's exact
preimage convention. The app therefore does not claim credential issuance,
claim validation, signature verification, DID registration, or transaction
submission.

No wallet signature, transaction, deployment, funded account, secret, or live
network request was used during this verification pass.
