# MiniAppEventTicketPass | Event Ticket Pass

Event Ticket Pass issues NEP-11 ticket NFTs for on-chain events and enables QR-based
check-in by marking tickets as used.

## Features
- Create events with supply limits
- Issue NEP-11 tickets to recipients
- Transfer tickets before check-in
- Creator/gateway check-in (marks ticket as used)

## Core Methods

### `CreateEvent`
Creates an event and returns the new `eventId`.

```
CreateEvent(
  UInt160 creator,
  string name,
  string venue,
  BigInteger startTime,
  BigInteger endTime,
  BigInteger maxSupply,
  string notes
)
```

### `UpdateEvent`
Updates event metadata (creator-only).

```
UpdateEvent(
  UInt160 creator,
  BigInteger eventId,
  string name,
  string venue,
  BigInteger startTime,
  BigInteger endTime,
  BigInteger maxSupply,
  string notes
)
```

### `SetEventActive`
Enables/disables ticket issuance and check-in.

```
SetEventActive(UInt160 creator, BigInteger eventId, bool active)
```

### `IssueTicket`
Issues a NEP-11 ticket. Token IDs are formatted as `eventId-serial`.

```
IssueTicket(UInt160 creator, UInt160 recipient, BigInteger eventId, string seat, string memo)
```

### `CheckIn`
Marks a ticket as used (creator or gateway).

```
CheckIn(UInt160 creator, ByteString tokenId)
```

### `Transfer`
NEP-11 transfer (fails if ticket already used).

```
Transfer(UInt160 from, UInt160 to, ByteString tokenId, object data)
```

## Read Methods
- `GetEventDetails(eventId)`
- `GetTicketDetails(tokenId)`
- `GetCreatorEvents(creator, offset, limit)`
- `tokens`, `tokensOf`, `properties` (NEP-11)

## Notes
- Uses `MiniAppBase` update method for upgrades.
- `startTime`/`endTime` are Unix seconds (`Runtime.Time`).
