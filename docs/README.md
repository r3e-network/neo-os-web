# Documentation Index

This repository treats the [Neo Service Layer Specification](requirements.md)
as the single source of truth for the platform.

## Quick Navigation

| Category | Document | Description |
|----------|----------|-------------|
| **Start Here** | [Quickstart Tutorial](quickstart-tutorial.md) | End-to-end tutorial: zero to running in 15 minutes |
| **Services** | [Service Catalog](service-catalog.md) | Complete reference for all 17 services |
| **Development** | [Developer Guide](developer-guide.md) | Building and extending the Service Layer |
| **Architecture** | [Architecture Layers](architecture-layers.md) | 4-layer design (Platform → Framework → Engine → Services) |
| **Supabase** | [Supabase Setup](supabase-setup.md) | Self-hosted Supabase Postgres + GoTrue profile and env matrix |
| **Deep Dives** | [Framework Guide](framework-guide.md) | ServiceBase, Builder, Manifest, Testing |
| **Deep Dives** | [Engine Guide](engine-guide.md) | Registry, Lifecycle, Bus, Health monitoring |
| **Deep Dives** | [Service Engine](service-engine.md) | Automated service invocation and callbacks |
| **Deployment** | [Deployment Guide](deployment-guide.md) | Production deployment with Docker/Kubernetes |
| **Specification** | [Requirements](requirements.md) | Single source of truth |

### SDKs
- [TypeScript Client](../sdk/typescript/client/README.md) — typed API surface with Supabase refresh token support
- [Go Client](../sdk/go/client/README.md) — typed client with Supabase refresh token support

---

## Service Tutorials

### Core Services
| Service | Tutorial | Description |
|---------|----------|-------------|
| Accounts | [API Examples](examples/services.md#accounts) | Account management |
| Functions | [API Examples](examples/services.md#functions) | Serverless function execution |
| Automation | [Automation Guide](examples/automation.md) | Cron-style job scheduling |
| Triggers | [Triggers Guide](examples/triggers.md) | Event/webhook routing |
| Secrets | [Secrets Guide](examples/secrets.md) | Encrypted secret storage |

### Oracle & Data Services
| Service | Tutorial | Description |
|---------|----------|-------------|
| Oracle | [API Examples](examples/services.md#oracle-http-adapter) | HTTP data adapters |
| DataFeeds | [DataFeeds Quickstart](examples/datafeeds.md) | Chainlink-style signed feeds |
| PriceFeeds | [PriceFeeds Quickstart](examples/pricefeeds.md) | Deviation-based price aggregation |
| DataStreams | [API Examples](examples/services.md#data-streams) | Real-time data streams |
| DataLink | [DataLink Quickstart](examples/datalink.md) | Data delivery channels |

### Randomness Services
| Service | Tutorial | Description |
|---------|----------|-------------|
| Random | [Randomness Guide](examples/randomness.md#random-service) | ED25519 signed random |
| VRF | [Randomness Guide](examples/randomness.md#vrf-service) | Verifiable random functions |

### Financial Services
| Service | Tutorial | Description |
|---------|----------|-------------|
| GasBank | [GasBank Workflows](gasbank-workflows.md) | Gas account management |

### Cross-Chain & Advanced
| Service | Tutorial | Description |
|---------|----------|-------------|
| CCIP | [Cross-Chain Guide](examples/crosschain.md#ccip-service) | Cross-chain messaging |
| CRE | [Cross-Chain Guide](examples/crosschain.md#cre-service) | Workflow orchestration |
| Confidential | [Confidential Guide](examples/confidential.md#confidential-computing-service) | TEE enclave management |
| DTA | [Confidential Guide](examples/confidential.md#dta-service) | Trading infrastructure |

### Engine Integration
| Topic | Tutorial | Description |
|-------|----------|-------------|
| Event Bus | [Bus Quickstart](examples/bus.md) | Pub/sub messaging |
| System APIs | [API Examples](examples/services.md#discover-services-via-the-system-apis) | Module discovery |

---

## Architecture Documentation

### Getting Started
- [Quickstart Tutorial](quickstart-tutorial.md) - **NEW**: End-to-end tutorial (15 minutes)
- [Architecture Layers](architecture-layers.md) - **Start here**: 4-layer design guide

### Core Architecture
- [System Architecture](system-architecture.md) - Deployment topology and data flows
- [Engine Guide](engine-guide.md) - Complete engine reference (Registry, Lifecycle, Bus, Health)
- [Framework Guide](framework-guide.md) - ServiceBase, Builder, Manifest, Testing utilities
- [Supabase Integration](supabase-integration.md) - Auth, Storage, Realtime integration

### Code Layout
```
system/
├── core/         # Service Engine (Registry, Lifecycle, Bus)
├── framework/    # Service SDK (ServiceBase, Builder, Manifest)
├── platform/     # Platform services (database, migrations)
├── runtime/      # Package runtime (loader, permissions)
├── bootstrap/    # Application bootstrapping and component wiring
├── events/       # Event dispatcher, request router, indexer bridge
└── api/          # User API (accounts, secrets, contracts, functions)

packages/         # Service packages (com.r3e.services.*)
applications/     # HTTP API, storage adapters
contracts/neo-n3/ # Neo N3 smart contracts (C#)
pkg/              # Shared libraries (supabase, pgnotify, blob)
```

---

## Operations & Security

### Deployment
- [Deployment Guide](deployment-guide.md) - **NEW**: Production deployment with Docker/Kubernetes
- [Operations Runbook](ops-runbook.md) - Start/stop, monitoring, troubleshooting
- Supabase smoke: `make supabase-smoke` (or `./scripts/supabase_smoke.sh`) spins up the Supabase profile (GoTrue/PostgREST/Kong/Studio) and checks `/auth/refresh` + `/system/status` via the appserver.

### Dashboard
- [Dashboard Smoke Checklist](dashboard-smoke.md) - Dashboard verification
- [Dashboard E2E Testing](dashboard-e2e.md) - Playwright testing

### Security
- [Security & Production Hardening](security-hardening.md) - Production deployment
- [Tenant Quickstart](tenant-quickstart.md) - Multi-tenancy setup

### Auditing
- `/admin/audit?limit=...&offset=...` (admin JWT) with filters
- CLI helper: `slctl audit --limit 100 --user admin`

---

## Integration References

### NEO N3 Integration
- [Contract System](contract-system.md) - **Complete architecture**: contracts, event system, user API
- [NEO API Reference](neo-api.md) - Indexer and snapshot APIs
- [NEO Operations](neo-ops.md) - Running NEO nodes
- [Blockchain Contracts](blockchain-contracts.md) - Push Service Layer feeds into privnet contracts via SDK helpers
- [NEO Layering Plan](neo-layering-summary.md) - Architecture roadmap
- [NEO Contract Set](neo-n3-contract-set.md) - Smart contract layout
- [Contract ↔ Service Alignment](neo-contracts-alignment.md) - Field mappings

### JAM Integration
- [JAM Integration Design](jam/polkadot-jam-integration-design.md) - Overview
- [JAM Accumulator Plan](jam/jam-accumulator-plan.md) - Implementation plan
- [JAM Receipts and Roots](jam/jam-receipts-and-roots.md) - Receipt system
- [JAM Hardening](jam/jam-hardening.md) - Security hardening

---

## API Quick Reference

### Core Bus Endpoints
```bash
# Publish events
POST /system/events
{"event": "my.event", "payload": {...}}

# Push data
POST /system/data
{"topic": "my.topic", "payload": {...}}

# Invoke compute
POST /system/compute
{"payload": {...}}

# CLI shortcuts
slctl bus events --event my.event --payload '{}'
slctl bus data --topic my.topic --payload '{}'
slctl bus compute --payload '{}'
```

### System Status
```bash
# Service status
GET /system/status

# Service descriptors
GET /system/descriptors

# Health checks
GET /readyz
GET /livez
```

---

## Testing

### Unit Tests
```bash
go test ./...
go test ./packages/... -cover
```

### Integration Tests
```bash
# In-memory
go test ./applications/httpapi -run IntegrationHTTPAPI

# PostgreSQL
go test -tags "integration postgres" ./applications/httpapi -run IntegrationPostgres
```

### Dashboard E2E
```bash
cd apps/dashboard
API_URL=http://localhost:8080 API_TOKEN=dev-token npm run e2e
```

---

## CLI Reference

See [CLI Quick Reference](../README.md#cli-quick-reference) in main README.

---

## Working With Documentation

1. **Start with Specification**: Update [requirements.md](requirements.md) first
2. **Add Examples**: Include curl/CLI snippets in relevant guides
3. **Link Implementation**: Reference file paths with line numbers
4. **Keep Realistic**: Use production-like payloads

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Quickstart Tutorial | ✅ Complete | 2025-11 |
| Service Catalog | ✅ Complete | 2025-11 |
| Developer Guide | ✅ Complete | 2025-11 |
| Framework Guide | ✅ Complete | 2025-11 |
| Engine Guide | ✅ Complete | 2025-11 |
| Deployment Guide | ✅ Complete | 2025-11 |
| All Service Tutorials | ✅ Complete | 2025-11 |
| Architecture Docs | ✅ Complete | 2025-11 |
| Operations Docs | ✅ Complete | 2025-11 |
