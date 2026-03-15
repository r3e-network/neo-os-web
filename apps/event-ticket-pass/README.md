# Event Ticket Pass

NEP-11 event tickets with QR check-in.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-event-ticket-pass` |
| **Category** | utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Create events with supply limits
- Issue NEP-11 tickets to attendees
- Display ticket QR for check-in
- Creator/gateway check-in marks tickets as used

## User Flow

1. **Create event**: set title, venue, schedule, and max supply.
2. **Issue tickets**: send tickets to attendee addresses.
3. **Show QR**: attendee opens “My Tickets” to show QR.
4. **Check-in**: organizer scans token ID and marks used.

## Contract Methods

- `CreateEvent(creator, name, venue, startTime, endTime, maxSupply, notes)`
- `UpdateEvent(creator, eventId, name, venue, startTime, endTime, maxSupply, notes)`
- `IssueTicket(creator, recipient, eventId, seat, memo)`
- `CheckIn(creator, tokenId)`
- `Transfer(from, to, tokenId, data)`
- `GetEventDetails(eventId)`
- `GetTicketDetails(tokenId)`

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ❌ No |
| Automation | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | `https://testnet.neotube.io` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://neotube.io` |

> Contract deployment is pending; `neo-manifest.json` keeps empty addresses until deployment.

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
5. **On-Chain Verification**: Organizers verify authenticity by checking the blockchain
6. **Anti-Fraud**: Tickets can only be used once through the check-in mechanism
7. **Transferability**: Tickets can be transferred between wallets if allowed by the event

## License

MIT License - R3E Network
