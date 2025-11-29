# Neo N3 Service Layer

A lightweight orchestration runtime for Neo N3 blockchain, providing off-chain services that complement on-chain smart contracts.

## What is Service Layer?

Service Layer bridges the gap between Neo N3 smart contracts and external data/compute resources. It provides:

- **Oracle Services** - Fetch and verify external data for smart contracts
- **VRF (Verifiable Random Function)** - Cryptographically secure randomness
- **Data Feeds** - Aggregated price feeds with deviation-based updates
- **Automation** - Cron-style job scheduling for contract interactions
- **Functions** - Serverless compute for complex off-chain logic
- **Gas Bank** - Unified fee management and balance tracking
- **Secrets Vault** - Encrypted storage for API keys and credentials

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Contracts                          │
│  (Custom business logic deployed via SDK)                   │
├─────────────────────────────────────────────────────────────┤
│                   Service Contracts                         │
│  OracleHub │ RandomnessHub │ DataFeedHub │ Automation       │
├─────────────────────────────────────────────────────────────┤
│                   Engine Contracts                          │
│  Manager │ AccountManager │ ServiceRegistry │ GasBank       │
└─────────────────────────────────────────────────────────────┘
         ↕ Events/Callbacks
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer Backend                     │
│  Event Dispatcher │ Request Router │ Service Handlers       │
├─────────────────────────────────────────────────────────────┤
│                      User API                               │
│  Accounts │ Secrets │ Functions │ Automation │ GasBank      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone and run
git clone https://github.com/R3E-Network/service_layer.git
cd service_layer
make run

# API: http://localhost:8080
# Dashboard: http://localhost:8081
```

## Configuration

```bash
# Required
DATABASE_URL=postgres://user:pass@localhost:5432/service_layer

# Optional
API_TOKENS=your-api-token
SECRETS_ENCRYPT_KEY=***REMOVED***
CONTRACT_TYPE_MAPPINGS=0x1234:oraclehub,0x5678:vrf
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/accounts` | Account management |
| `/api/v1/secrets` | Secret key storage |
| `/api/v1/contracts` | Contract registration |
| `/api/v1/functions` | Function deployment |
| `/api/v1/requests` | Service request tracking |
| `/api/v1/balance` | Gas bank balance |
| `/healthz` | Health check |
| `/system/status` | System status |

## SDK

**Go:**
```go
import sl "github.com/R3E-Network/service_layer/sdk/go/client"

client := sl.New(sl.Config{
    BaseURL: "http://localhost:8080",
    Token:   "your-token",
})
account, _ := client.Accounts.Create(ctx, "alice", nil)
```

**TypeScript:**
```typescript
import { ServiceLayerClient } from '@service-layer/client';

const client = new ServiceLayerClient({
    baseURL: 'http://localhost:8080',
    token: 'your-token',
});
const account = await client.accounts.create('alice');
```

## Development

```bash
# Build
make build

# Test
go test ./...

# Run locally
go run ./cmd/appserver -dsn "postgres://..."
```

## Documentation

- [Architecture](docs/architecture-layers.md)
- [Service Catalog](docs/service-catalog.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Contract System](docs/contract-system.md)

## License

MIT License - see [LICENSE](LICENSE) for details.
