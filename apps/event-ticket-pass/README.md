# Event Ticket Pass

NEP-11 event tickets with QR check-in.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-event-ticket-pass` |
| **Category** | Social |
| **Version** | 1.3.0 |
| **Framework** | Host-native React playarea |

## Features

- Create events with supply limits
- Issue NEP-11 tickets to attendees
- Display ticket QR for check-in
- Creator/gateway check-in marks tickets as used
- Holder-side transfer from a verified wallet inventory
- Event-bound transaction confirmation plus authoritative contract readback
- Active-event discovery with an honest organizer-invitation model
- Exact transaction journal and refresh recovery for every write operation
- Recovery records are cleared only after storage deletion reads back successfully
- Canonical script-hash arguments across organizer, recipient, gate, and transfer writes
- Runtime network, contract checksum, NEP-11, ABI, and host-binding verification
- Organizer gate queue reconstructed from the selected event's issued token IDs, kept separate from the holder wallet

## User Flow

1. **Discover**: browse active, non-expired events published by the contract.
2. **Receive**: an organizer issues the selected pass to an attendee wallet.
3. **Ticket wallet**: the holder opens a chain-verified pass with its real QR token ID.
4. **Check-in**: the organizer looks up the live pass, reviews it, then marks it used.
5. **Recover**: a broadcast that is still indexing remains pending across refresh and can be resumed from its exact transaction ID.

The deployed ABI has no paid purchase or attendee self-claim method. The UI therefore labels public events as organizer-issued and does not render a fake Buy or Claim action.

## Contract Methods

- `CreateEvent(creator, name, venue, startTime, endTime, maxSupply, notes)`
- `UpdateEvent(creator, eventId, name, venue, startTime, endTime, maxSupply, notes)`
- `IssueTicket(creator, recipient, eventId, seat, memo)`
- `CheckIn(creator, tokenId)`
- `Transfer(to, tokenId, data)`
- `GetEventDetails(eventId)`
- `GetTicketDetails(tokenId)`

## Permissions

| Permission | Required |
|------------|----------|
| Payments | No |
| Automation | No |
| RNG | No |
| Data Feed | No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x90bad472146aab97de71498e8d736c3124e7c82b` |
| **RPC** | `https://api.n3index.dev/testnet` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x90bad472146aab97de71498e8d736c3124e7c82b) |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x90bad472146aab97de71498e8d736c3124e7c82b` |
| **RPC** | `https://api.n3index.dev/mainnet` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x90bad472146aab97de71498e8d736c3124e7c82b) |

> Read-only deployment status was rechecked on 2026-07-11: both networks return `MiniAppEventTicketPass` with the expected event/ticket ABI at the manifest hash. This frontend pass did not replay signed create/issue/check-in/transfer transactions, so it does not claim a fresh end-to-end write smoke test.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the exact read-only evidence and the required signed release checklist.

## Usage

### For Event Creators

1. **Create Event**: Set event title, venue, date/time, and ticket supply limit
2. **Configure Details**: Add event description and any special requirements
3. **Issue Tickets**: Send tickets to attendee wallet addresses
4. **Manage Check-ins**: Scan attendee QR codes and mark tickets as used at the event

### For Attendees

1. **Receive Ticket**: Get ticket transferred to your Neo wallet address
2. **View Ticket**: Open "My Tickets" to see event details and QR code
3. **Show QR**: Present your QR code at the event entrance for scanning
4. **Verify Entry**: Organizer scans and validates your ticket on the blockchain

## How It Works

Event Ticket Pass uses NEP-11 non-fungible tokens for ticketing:

1. **NFT Tickets**: Each ticket is a unique NEP-11 token on Neo N3 blockchain
2. **Event Creation**: Organizers create events with defined supply and metadata
3. **Ticket Distribution**: Tickets are minted and transferred to attendee wallets
4. **QR Code Generation**: Each ticket generates a scannable QR code containing token ID
5. **On-Chain Verification**: The UI only reports success after the matching transaction event and an authoritative contract readback agree
6. **Anti-Fraud**: Tickets can only be used once through the check-in mechanism
7. **Transferability**: Unused tickets can be transferred by their current owner

## Production behavior

- A broadcast transaction is not treated as success when event confirmation times out.
- Create, issue, check-in, toggle, and transfer events are matched to the requested event, token, organizer, or recipient before local state changes.
- Issuing a pass to another wallet never inserts that pass into the organizer's “My Tickets” inventory.
- Holder inventory reconstruction is bounded. When the scan cannot prove the complete wallet balance, the UI labels the result partial instead of claiming a false total.
- Check-in is a two-step flow: look up and review the live ticket first, then mark it used.
- Before signing, the runtime checks the explicit wallet network, configured script hash, deployed NEF checksum `2976433161`, NEP-11 declaration, required method/event signatures, and the host bridge's `symbol=TICKET` / `decimals=0` reads.
- Every broadcast txid is persisted immediately. A second write is blocked until the exact pending event and resulting contract state are recovered or verified.
- A terminal VM `FAULT` is shown as a failed action and removed from the pending queue; an unavailable application log stays honestly pending.
- Wallet/network changes invalidate in-flight account reads, clear the old wallet surface, and re-attest the new chain context before repopulating it.
- Event discovery and organizer event lists are all-or-preserve snapshots: a failed expected detail read never silently publishes a partial list.
- Gate lookup results are request-bound; changing the scanned token, wallet, network, or contract while a read is running discards the stale result.
- Create, issue, toggle, check-in, and transfer share one write lock, so two wallet prompts cannot race before the first txid is journaled.
- Wallet connection and recovery use the same busy boundary; a competing action reports that work is in progress instead of being silently ignored.
- Event IDs remain integer-safe strings, zero-duration events are rejected before signing, and standard `Hash160` arguments use the framework's canonical builder.
- A verified transaction remains pending when recovery-record cleanup cannot be read back, allowing cleanup to be retried without replaying the action.
- The gate queue is reconstructed from the selected organizer event. It never relabels the connected holder's personal ticket wallet as an attendee queue.
- This release reuses the repository's existing `pass-artwork.webp`, `logo.webp`, and `banner.webp`; it introduces no copied assets from external game or reference repositories.

## License

MIT License - R3E Network
