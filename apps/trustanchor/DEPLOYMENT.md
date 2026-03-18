# TrustAnchor Deployment Notes

## Current Direction

TrustAnchor is no longer planned around one deployed agent contract per candidate.

The target architecture is:

1. 21 verification-script routing accounts.
2. Each routing account maps to one candidate target.
3. Fresh deposits enter slot 21 first.
4. Admin rebalances exposure only by moving real NEO from slot A to slot B.
5. No synthetic weight register and no child agent-contract fleet.

## What This Means Operationally

- Account provisioning is an account-generation problem, not a contract-deployment problem.
- Routing slots should be generated from the final verification-script scheme used by operations.
- The miniapp frontend can ship before the live contract hash is assigned, because the UI now documents the new routing model directly.

## Testnet Rollout Checklist

- Finalize the verification-script account construction scheme.
- Generate and archive all 21 routing account addresses.
- Bind one candidate public key to each routing slot.
- Verify slot 21 is the default ingress route for all fresh deposits.
- Confirm the admin rebalance flow is implemented as real transfers between slots.
- Validate reward accounting against the final on-chain contract.
- Only then write the testnet contract hash back into `neo-manifest.json`.

## Status

The trustanchor miniapp frontend has already been refactored to the verification-script routing model.

The live trustanchor contract is intentionally still unset in this repository until the new account model is finalized and tested end-to-end.
