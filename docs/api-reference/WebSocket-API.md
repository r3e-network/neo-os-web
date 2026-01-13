# WebSocket API

> Real-time WebSocket connections for live data

## Overview

The WebSocket API provides real-time data streaming for price feeds, events, and notifications.

| Feature            | Description                           |
| ------------------ | ------------------------------------- |
| **Low Latency**    | Sub-100ms message delivery            |
| **Auto-Reconnect** | Built-in reconnection support         |
| **Multiplexing**   | Multiple subscriptions per connection |

## Connection

### Endpoint

| Environment | URL                               |
| ----------- | --------------------------------- |
| Production  | `wss://api.neo.org/v1/ws`         |
| Testnet     | `wss://testnet-api.neo.org/v1/ws` |

```javascript
const ws = new WebSocket("wss://api.neo.org/v1/ws");

ws.onopen = () => {
    ws.send(
        JSON.stringify({
            type: "auth",
            token: "YOUR_API_KEY",
        }),
    );
};
```

## Subscriptions

### Price Feed

```json
{
    "type": "subscribe",
    "channel": "price",
    "pair": "GAS-USD"
}
```

### Events

```json
{
    "type": "subscribe",
    "channel": "events",
    "app_id": "my-app"
}
```

## Message Format

```json
{
    "type": "price",
    "pair": "GAS-USD",
    "price": "5.23",
    "timestamp": "2026-01-11T00:00:00Z"
}
```

## Next Steps

- [Error Codes](./Error-Codes.md)
- [Rate Limits](./Rate-Limits.md)

## Available Channels

| Channel  | Description             | Data Type    |
| -------- | ----------------------- | ------------ |
| `price`  | Real-time price updates | Price tick   |
| `events` | App-specific events     | Event object |
| `blocks` | New block notifications | Block header |
| `txs`    | Transaction updates     | Transaction  |

## Connection Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Connect │────▶│  Auth   │────▶│Subscribe│────▶│ Stream  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                     │
                                                     ▼
                                               ┌─────────┐
                                               │  Close  │
                                               └─────────┘
```

## Error Handling

```javascript
ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
    if (event.code !== 1000) {
        // Reconnect on abnormal close
        setTimeout(connect, 1000);
    }
};
```

## Heartbeat

Send ping every 30 seconds to keep connection alive:

```javascript
setInterval(() => {
    ws.send(JSON.stringify({ type: "ping" }));
}, 30000);
```

## Unsubscribe

```json
{
    "type": "unsubscribe",
    "channel": "price",
    "pair": "GAS-USD"
}
```

## Close Codes

| Code | Meaning          |
| ---- | ---------------- |
| 1000 | Normal closure   |
| 1001 | Going away       |
| 1008 | Policy violation |
| 4001 | Auth failed      |
| 4002 | Rate limited     |
