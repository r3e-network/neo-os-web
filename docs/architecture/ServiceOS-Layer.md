# ServiceOS Layer

> Service orchestration architecture for the Neo Service Layer

## Overview

The ServiceOS Layer manages service lifecycle, routing, and coordination across the TEE mesh. It provides a unified interface for all backend services while ensuring high availability and security.

### Key Responsibilities

| Responsibility     | Description                              |
| ------------------ | ---------------------------------------- |
| **Routing**        | Direct requests to appropriate services  |
| **Load Balancing** | Distribute load across service replicas  |
| **Health Checks**  | Monitor service health and availability  |
| **Configuration**  | Manage service configuration and secrets |
| **Observability**  | Collect metrics, logs, and traces        |

## Architecture

```
┌─────────────────────────────────────────┐
│            Edge Gateway                  │
│         (Supabase Edge)                  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Service Router                 │
│    (Load Balancing + Health Checks)      │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌───────┐    ┌───────┐    ┌───────┐
│  VRF  │    │ Feeds │    │Oracle │
└───────┘    └───────┘    └───────┘
```

## Components

### Edge Gateway

- Authentication & authorization
- Rate limiting
- Request validation

### Service Router

- Health-based routing
- Automatic failover
- Load distribution

### Service Registry

- Dynamic discovery
- Version management
- Configuration sync

## Service Lifecycle

| State    | Description          |
| -------- | -------------------- |
| Starting | Initializing enclave |
| Ready    | Accepting requests   |
| Draining | Graceful shutdown    |
| Stopped  | Not running          |

## Configuration

```yaml
services:
    vrf:
        replicas: 3
        healthCheck:
            interval: 10s
            timeout: 5s
```

## Next Steps

- [Capabilities System](./Capabilities-System.md)
- [Security Model](./Security-Model.md)

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Request Flow                                │
└─────────────────────────────────────────────────────────────────────┘

  Client          Edge Gateway       Router          Service
    │                  │               │               │
    │  1. Request      │               │               │
    │─────────────────▶│               │               │
    │                  │  2. Auth      │               │
    │                  │  3. Validate  │               │
    │                  │  4. Route     │               │
    │                  │──────────────▶│               │
    │                  │               │  5. Select    │
    │                  │               │──────────────▶│
    │                  │               │               │
    │                  │               │  6. Execute   │
    │                  │               │◀──────────────│
    │                  │◀──────────────│               │
    │◀─────────────────│               │               │
    │  7. Response     │               │               │
```

## Monitoring & Observability

### Metrics

| Metric               | Description                 |
| -------------------- | --------------------------- |
| `request_count`      | Total requests per service  |
| `request_latency_ms` | Request latency percentiles |
| `error_rate`         | Error rate per service      |
| `active_connections` | Current active connections  |

### Health Check Endpoints

```bash
# Service health
GET /health

# Detailed status
GET /health/detailed
```

Response:

```json
{
    "status": "healthy",
    "services": {
        "vrf": { "status": "up", "latency_ms": 12 },
        "datafeed": { "status": "up", "latency_ms": 8 }
    }
}
```
