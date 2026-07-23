# PlatformDeFi Legacy Credit Snapshot

Generated: 2026-07-23T05:21:42.650Z

## Summary

- Network: neo-n3-testnet (magic 894710606)
- RPC block count: 17924995
- PlatformDeFi: 0x39d4584ddb0731e48e611647931993ee033bf373
- Legacy credit rows: 3
- NEO prefix 0x14: 0 rows, total 0, native balance 8, gap 8
- GAS prefix 0x15: 3 rows, total 1600000002, native balance 1465773666, gap -134226336
- Migration status: blocked-nonempty-and-underbacked
- Transactions broadcast: 0
- Boundary: This is a credential-free read-only RPC snapshot, not an atomic migration lock. A later update still requires deposits to be prevented during an exact final snapshot. Non-empty payer-global rows cannot be assigned to appIds without an explicit reviewed migration.

## Decision

Do not execute the live PlatformDeFi v1.2 update yet. The local candidate has an auto-paused exact-snapshot recovery bridge, but the legacy credit total exceeds native backing. First separately approve and simulate the reported deficit top-up (GAS 134226336 datoshi), exact snapshot initialization, activation, and every payer withdrawal. With zero tenant bindings, still prefer a fresh v1.2 deployment.
