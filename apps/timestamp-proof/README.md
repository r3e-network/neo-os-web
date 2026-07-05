# Timestamp Proof | 时间戳证明

`Timestamp Proof` is a local SHA-256 proof journal with optional Neo N3 anchoring.

## Current Behavior

- hashes content locally in the browser with `SHA-256`
- stores proof entries in browser local storage on the current device
- assigns a local proof id for later lookup
- lets the user re-open and verify saved proofs by id, digest, or original content
- optionally anchors a saved digest on Neo N3 with a real 0-GAS self-transfer when a connected wallet is available

## Privacy And Trust Model

- source content stays on the user's device
- local proofs are private and free
- anchoring publishes only `timestamp-proof:<digest>` in a public Neo transaction data field
- anchored proofs can be verified by checking the transaction payload and block time
- local proofs are only available in the browser profile that created them

## Usage

1. Enter text, a document hash, or a short proof note.
2. Create a local proof entry.
3. Re-open or verify the saved entry by proof id, digest, or original content.
4. Optional: connect a wallet and anchor the latest proof digest on-chain for third-party verification.

## What It Does Not Do

- it does not upload raw documents
- it does not store source content on-chain
- it does not pretend local-only proofs are public blockchain evidence
- it does not depend on Oracle or AA for the core local proof path

## Architecture

- Type: frontend tool with optional wallet transaction
- Hash function: `SHA-256`
- Local storage: browser local storage
- Anchor pattern: 0-GAS self-transfer embedding `timestamp-proof:<digest>`

## Next Upgrade Path

If Timestamp Proof needs a dedicated contract later, add the contract first and switch the frontend + manifest together in the same change. Do not reintroduce synthetic transaction ids or pseudo-contract calls without a deployed source of truth.
