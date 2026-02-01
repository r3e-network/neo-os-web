# REST API

> RESTful API endpoints for the Neo Service Layer

## Base URL

| Environment | URL                              |
| ----------- | -------------------------------- |
| Production  | `https://api.neo.org/v1`         |
| Testnet     | `https://testnet-api.neo.org/v1` |

## Authentication

All requests require an API key in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.neo.org/v1/feeds
```

## Endpoints

### Price Feeds

| Method | Endpoint        | Description    |
| ------ | --------------- | -------------- |
| GET    | `/feeds`        | List all feeds |
| GET    | `/price/{pair}` | Get price      |

### VRF (Randomness)

| Method | Endpoint       | Description     |
| ------ | -------------- | --------------- |
| POST   | `/random`      | Generate random |
| GET    | `/random/{id}` | Get result      |

### Payments

| Method | Endpoint         | Description |
| ------ | ---------------- | ----------- |
| POST   | `/payments/gas`  | Pay GAS     |
| GET    | `/payments/{id}` | Get status  |

## Response Format

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-11T00:00:00Z"
}
```

## Next Steps

- [WebSocket API](./WebSocket-API.md)
- [Error Codes](./Error-Codes.md)

## Detailed Endpoint Examples

### GET /feeds

List all available price feeds.

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.neo.org/v1/feeds
```

**Response:**

```json
{
    "success": true,
    "data": [
        { "pair": "GAS-USD", "decimals": 8, "active": true },
        { "pair": "NEO-USD", "decimals": 8, "active": true }
    ]
}
```

### GET /price/{pair}

Get current price for a trading pair.

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.neo.org/v1/price/GAS-USD
```

**Response:**

```json
{
    "success": true,
    "data": {
        "pair": "GAS-USD",
        "price": "5.23",
        "timestamp": "2026-01-11T08:00:00Z",
        "sources": 5
    }
}
```

### POST /random

Request a verifiable random number.

**Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"min": 1, "max": 100, "seed": "optional"}' \
  https://api.neo.org/v1/random
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "rng_abc123",
        "value": 42,
        "proof": "0x...",
        "timestamp": "2026-01-11T08:00:00Z"
    }
}
```

## Pagination

List endpoints support pagination:

| Parameter | Type | Default | Description              |
| --------- | ---- | ------- | ------------------------ |
| `page`    | int  | 1       | Page number              |
| `limit`   | int  | 20      | Items per page (max 100) |

```bash
curl "https://api.neo.org/v1/feeds?page=1&limit=10"
```

### POST /payments/gas

Send a GAS payment.

**Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", "amount": "1.5", "memo": "Payment"}' \
  https://api.neo.org/v1/payments/gas
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "pay_xyz789",
        "status": "pending",
        "tx_hash": "0x...",
        "amount": "1.5",
        "to": "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"
    }
}
```

### GET /payments/{id}

Get payment status.

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "pay_xyz789",
        "status": "confirmed",
        "confirmations": 3
    }
}
```

### Governance Endpoints

| Method | Endpoint              | Description  |
| ------ | --------------------- | ------------ |
| GET    | `/governance/members` | List council |
| POST   | `/governance/vote`    | Cast vote    |

### Secrets Endpoints

| Method | Endpoint         | Description   |
| ------ | ---------------- | ------------- |
| POST   | `/secrets`       | Store secret  |
| GET    | `/secrets/{key}` | Get secret    |
| DELETE | `/secrets/{key}` | Delete secret |

### Automation Endpoints

| Method | Endpoint           | Description |
| ------ | ------------------ | ----------- |
| POST   | `/automation/jobs` | Create job  |
| GET    | `/automation/jobs` | List jobs   |
| DELETE | `/automation/{id}` | Delete job  |

### GasBank Endpoints

| Method | Endpoint           | Description |
| ------ | ------------------ | ----------- |
| GET    | `/gasbank/quota`   | Get quota   |
| POST   | `/gasbank/sponsor` | Sponsor tx  |
