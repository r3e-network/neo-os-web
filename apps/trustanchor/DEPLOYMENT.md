# TrustAnchor Deployment Notes

## Current Direction

TrustAnchor is no longer planned around one deployed agent contract per candidate.

The target architecture is:

1. 21 verification-script agent accounts.
2. Each agent account maps to one candidate target.
3. Fresh deposits enter the agent account for candidate 21 first.
4. Admin rebalances exposure only by moving real NEO from agent A to agent B.
5. No synthetic weight register and no child agent-contract fleet.

## What This Means Operationally

- Account provisioning is an account-generation problem, not a contract-deployment problem.
- Agent accounts should be generated from the final verification-script scheme used by operations.
- The miniapp frontend can ship before the live contract hash is assigned, because the UI now documents the new routing model directly.

## Testnet Rollout Checklist

- Finalize the verification-script account construction scheme.
- Generate and archive all 21 verification-script agent account addresses.
- Bind one candidate public key to each agent account.
- Verify the agent account for candidate 21 is the default ingress route for all fresh deposits.
- Confirm the admin rebalance flow is implemented as real transfers from agent A to agent B.
- Validate reward accounting against the final on-chain contract.
- Only then write the testnet contract hash back into `neo-manifest.json`.

## Status

The trustanchor miniapp frontend has already been refactored to the verification-script agent-account model.

The testnet contract is live at `0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2`.

All 21 verification-script agent accounts have been generated from one admin key and written into the testnet contract state.

Current verified behavior:

- fresh user stake auto-routes into agent 21
- withdraw can queue when core liquidity is unavailable
- reward accounting follows the single-contract RPS model

Still pending before mainnet:

- production operating procedure for returning NEO from agent accounts to the core contract
- fee strategy for agent-account initiated return transactions
- full operator playbook for rebalancing and pending-withdraw settlement
