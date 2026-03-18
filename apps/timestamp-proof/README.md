# Timestamp Proof | 时间戳证明

`Timestamp Proof` is currently a stateless **local proof journal**, not a deployed on-chain contract flow.

## Current Behavior

- hashes content locally in the browser with `SHA-256`
- stores proof entries in browser local storage on the current device
- assigns a local proof id for later lookup
- lets the user re-open and verify saved proofs by id

## What It Does Not Do

- it does **not** submit a transaction
- it does **not** write hashes to Neo N3
- it does **not** depend on legacy receipt relays, Oracle, or AA for its current runtime path

## Why This Was Changed

The app manifest already marked Timestamp Proof as `stateless`, but the old frontend still tried to call a missing contract. That mismatch made the app unreliable. The current implementation matches the manifest and keeps the tool usable until a real contract-backed version is added.

## Usage

1. Enter text, a hash, or a short proof note.
2. Create a proof entry.
3. The app stores the entry locally with a generated proof id and timestamp.
4. Use the `Verify` tab and the proof id to re-open that saved entry later.

## Security Notes

- hashing happens locally in the browser
- raw content is never uploaded by this app
- proofs are only available on the device/browser profile that created them
- clearing browser storage removes saved proofs

## Architecture

- Type: frontend-only stateless tool
- Hash function: `SHA-256`
- Storage: browser local storage
- Network dependency: none for the core proof path

## Next Upgrade Path

If Timestamp Proof needs a real Neo N3 anchoring flow later, add a dedicated contract first and then switch the frontend + manifest together in the same change. Do not reintroduce pseudo-contract calls without a deployed source of truth.
