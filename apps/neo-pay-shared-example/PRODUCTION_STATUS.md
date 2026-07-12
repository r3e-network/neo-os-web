# NeoPay Stream Studio Production Status

Status date: **2026-07-12**

## Ready product surfaces

- Warm, high-contrast payment workstation centered on the real NeoPay vault artwork
- One primary action that switches to read-only pending recovery after submission
- Explicit Neo N3 address validation
- Exact NEO whole-token and GAS Fixed8 validation without rewriting the draft
- 1–365 day duration validation
- Mainnet/testnet canonical contract binding displayed in the ticket
- Role-specific authoritative lists for outgoing cancellation and incoming claims
- Secondary exact-ticket, history, recovery, and guide surfaces
- English and Chinese UI copy
- Shared-runtime composition metadata retained in `neo-manifest.json`

## Transaction lifecycle

Stream creation uses the shared `useNeoPayApp` domain module. The NEP-17 transfer and `createStream` call are submitted as one ordered multi-script transaction. A submitted transaction is persisted immediately as pending. It is not presented as success until a new authoritative creator stream is observed. Reload and manual refresh re-read state and do not submit another transaction.

Claim and cancel actions accept only stream IDs already present in the corresponding live list:

- `beneficiaryStreams` for claim
- `createdStreams` for cancel

## Honest unavailable states

When a role-list read fails, the product displays an unavailable notice and does not label an empty array as zero live streams. When only some detail reads fail, the shared domain module exposes a partial state and failed-read count; available rows may remain visible, but counts and empty-list conclusions stay hidden. Pending transaction IDs remain visible in the exact-ticket drawer until recovery resolves them.

## Verification boundary

This frontend pass uses read-only RPC, unit/component tests, TypeScript, scoped linting, a production build, and local static HTTP checks. It does not sign a wallet message, submit a funded transaction, deploy a contract, or copy build output into the host application.
