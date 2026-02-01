# Python SDK

> Official Python SDK for the Neo Service Layer

## Overview

The Python SDK provides Pythonic interfaces for scripting and backend integrations.

| Feature        | Description               |
| -------------- | ------------------------- |
| **Async**      | Full asyncio support      |
| **Type Hints** | Complete type annotations |
| **Pydantic**   | Validated response models |
| **Retry**      | Built-in retry logic      |

## Requirements

- Python 3.9+
- pip or poetry

## Installation

```bash
pip install neo-service-layer
# or
poetry add neo-service-layer
```

## Quick Start

```python
from neo_service_layer import Client

client = Client(api_key="YOUR_API_KEY")

# Get price feed
price = client.datafeed.get_price("GAS-USD")
print(f"GAS Price: {price.value}")
```

## Configuration

```python
client = Client(
    api_key="YOUR_API_KEY",
    base_url="https://testnet-api.neo.org/v1",
    timeout=30,
    retries=3,
)
```

## Services

### DataFeed

```python
# Get single price
price = client.datafeed.get_price("GAS-USD")

# List all feeds
feeds = client.datafeed.list_feeds()

# Async subscription
async for update in client.datafeed.subscribe("GAS-USD"):
    print(f"New price: {update.value}")
```

### VRF (Randomness)

```python
# Request random number
result = client.vrf.request_random(min_val=1, max_val=100)

# Get result by ID
random = client.vrf.get_result(result.id)
```

### Payments

```python
# Send GAS payment
tx = client.payments.send_gas(
    to="NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    amount="1.5"
)

# Check status
status = client.payments.get_status(tx.id)
```

### Governance

```python
# Get council members
members = client.governance.get_members()

# Vote for candidate
client.governance.vote(
    candidate="NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    amount=100
)
```

### Secrets

```python
# Store secret
client.secrets.store(key="api-key", value="sk_live_xxx")

# Get secret
secret = client.secrets.get("api-key")
```

## Error Handling

```python
from neo_service_layer.exceptions import APIError, RateLimitError

try:
    price = client.datafeed.get_price("INVALID")
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after}s")
except APIError as e:
    print(f"Error {e.code}: {e.message}")
```

## Async Support

```python
import asyncio
from neo_service_layer import AsyncClient

async def main():
    client = AsyncClient(api_key="YOUR_API_KEY")
    price = await client.datafeed.get_price("GAS-USD")
    print(price.value)

asyncio.run(main())
```

## Next Steps

- [Go SDK](./Go-SDK.md)
- [CLI Tool](./CLI-Tool.md)
