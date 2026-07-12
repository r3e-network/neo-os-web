# Production status

Status: production implementation complete; wallet-signed testnet execution remains an operator QA step.

Implemented:

- App-owned, resource-led `PlayStage` with one primary stake action.
- `OpenUiLite` controls and direct `PlayStage` import, avoiding the full UI runtime bundle.
- Empty generic manifest tabs, stats, sidebar, and operations so shell chrome does not duplicate the product surface.
- Exact launch-network, contract, detected-wallet-network, and wallet binding for every write.
- Strict integer decoding. Malformed or failed chain reads become unavailable, never a successful zero.
- Explicit unavailable states for anchor data and wallet-scoped NEO/GAS credit.
- Durable registration stages: fee -> anchor -> AA accounts -> 21-agent binding.
- Durable stake, redeem, claim, and credit-recovery records.
- Storage round-trip verification before the first wallet transaction.
- Broadcast-time txid persistence through `onTransactionSent`.
- VM FAULT termination, unknown-state retention, exact event matching, and exact readback before confirmation.
- Refresh recovery that checks or resumes only the recorded stage and never blindly replays an attempted transaction.
- Friendly primary error copy with diagnostic context kept in the secondary drawer.

Not performed in this implementation pass:

- Wallet signing or funded testnet transactions.
- Contract deployment or upgrade.
- Host distribution copy.
- Browser automation.
