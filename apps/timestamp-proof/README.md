# Timestamp Proof | 时间戳证明

`Timestamp Proof` is a local SHA-256 proof journal with optional Neo N3 anchoring.

## Current Behavior

- hashes content locally in the browser with `SHA-256`
- stores proof entries in browser local storage on the current device and verifies the write before reporting success
- keeps failed or malformed journal reads distinct from a genuinely empty journal and does not overwrite unreadable records
- assigns a local proof id for later lookup
- lets the user re-open local proofs by id, digest, or original content
- inspects portable JSON references and independently verifies anchored references or transaction ids against the selected Neo N3 network
- optionally anchors a saved digest on Neo N3 with a real 0-GAS self-transfer when a connected wallet is available
- persists a broadcast receipt as `pending`; only an exact HALT execution, matching zero-GAS self-transfer, and raw-script digest marker promotes it to `anchored`
- keeps an interrupted wallet submission behind a durable retry lock so a reload cannot blindly replay it
- revalidates stored anchored claims on reload and keeps pending/interrupted rows undeletable until their receipt state is resolved

## Privacy And Trust Model

- source content stays on the user's device
- local proofs are private and free
- the local timestamp comes from the device clock and is not independently trusted outside that browser profile
- anchoring publishes only `timestamp-proof:<digest>` in a public Neo transaction data field
- a transaction id is only a broadcast receipt, not proof of confirmation
- an unanchored portable JSON reference is a structured local claim, not independently trusted timestamp evidence
- anchored proofs are verified from the application log and raw transaction script; the confirmed block time is the public proof time
- the native GAS transfer uses canonical wallet script hashes and rejects malformed or mismatched wallet/event bindings
- local proofs are only available in the browser profile that created them

## Usage

1. Enter text, a document hash, or a short proof note.
2. Create a local proof entry.
3. Copy the portable reference or re-open the saved entry by proof id, digest, or original content.
4. Optional: connect a Neo N3 wallet and anchor the latest proof digest; the small network fee is shown before submission.
5. If the receipt is still pending, check it after the next block instead of submitting again.
6. Inspect a JSON reference; when it contains an anchor receipt, verify that receipt on its recorded network.

If the journal is unavailable, restore browser storage access and retry; the app intentionally shows `unavailable` instead of pretending there are zero records. If wallet submission was interrupted before a transaction id was recorded, inspect wallet history before clearing the retry lock.

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
- Supported networks: Neo N3 Mainnet and Testnet
- Receipt states: `local → preparing → pending → anchored | fault`

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), [NETWORK_STATUS.md](./NETWORK_STATUS.md), and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for the verified product boundary.

## Next Upgrade Path

If Timestamp Proof needs a dedicated contract later, add the contract first and switch the frontend + manifest together in the same change. Do not reintroduce synthetic transaction ids or pseudo-contract calls without a deployed source of truth.
