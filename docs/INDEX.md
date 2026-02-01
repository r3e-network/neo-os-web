# Neo Service Layer Documentation

> Complete documentation for the Neo MiniApp Platform and Service Layer

## Overview

The Neo Service Layer provides TEE-backed services for building secure, decentralized MiniApps on Neo N3.

| Component        | Description                      |
| ---------------- | -------------------------------- |
| **TEE Enclaves** | Intel SGX secure execution       |
| **ServiceOS**    | Service orchestration layer      |
| **Edge Layer**   | Authentication and rate limiting |
| **MiniApp SDK**  | Vue 3 composables for rapid dev  |

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MiniApp SDK                            │
│              (Vue 3 Composables + TypeScript)               │
├─────────────────────────────────────────────────────────────┤
│                      Edge Layer                             │
│           (Auth, Rate Limiting, Validation)                 │
├─────────────────────────────────────────────────────────────┤
│                    ServiceOS Layer                          │
│        (Request Routing, Capability Enforcement)            │
├─────────────────────────────────────────────────────────────┤
│                    TEE Enclaves                             │
│    (Oracle, VRF, Secrets, DataFeeds, Automation, GasBank)   │
├─────────────────────────────────────────────────────────────┤
│                     Neo N3 Network                          │
│              (Smart Contracts, Blockchain)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

### Getting Started

- [Introduction](./getting-started/Introduction.md) - Platform overview and key concepts
- [Quick Start](./getting-started/Quick-Start.md) - Get up and running in 5 minutes
- [Authentication](./getting-started/Authentication.md) - Authentication methods and flows
- [API Keys](./getting-started/API-Keys.md) - Managing API keys and credentials

### Architecture

- [TEE Trust Root](./architecture/TEE-Trust-Root.md) - Trusted Execution Environment foundation
- [ServiceOS Layer](./architecture/ServiceOS-Layer.md) - Service orchestration architecture
- [Capabilities System](./architecture/Capabilities-System.md) - Permission and capability model
- [Security Model](./architecture/Security-Model.md) - Defense-in-depth security approach

### Services

- [Oracle Service](./services/Oracle-Service.md) - Confidential oracle for external data
- [VRF Service](./services/VRF-Service.md) - Verifiable random function service
- [Secrets Service](./services/Secrets-Service.md) - Secure secrets management
- [DataFeeds Service](./services/DataFeeds-Service.md) - Real-time price feeds
- [Automation Service](./services/Automation-Service.md) - Scheduled task automation
- [GasBank Service](./services/GasBank-Service.md) - Gas sponsorship and management

### API Reference

- [REST API](./api-reference/REST-API.md) - RESTful API endpoints
- [WebSocket API](./api-reference/WebSocket-API.md) - Real-time WebSocket connections
- [Error Codes](./api-reference/Error-Codes.md) - Error codes and handling
- [Rate Limits](./api-reference/Rate-Limits.md) - Rate limiting policies

### SDKs & Tools

- [JavaScript SDK](./sdks/JavaScript-SDK.md) - JavaScript/TypeScript SDK
- [Go SDK](./sdks/Go-SDK.md) - Go SDK for backend integration
- [Python SDK](./sdks/Python-SDK.md) - Python SDK for scripting
- [CLI Tool](./sdks/CLI-Tool.md) - Command-line interface

---

## Quick Links

| Resource                                                                | Description         |
| ----------------------------------------------------------------------- | ------------------- |
| [GitHub Repository](https://github.com/aspect-build/neo-service-layer)  | Source code         |
| [API Status](https://status.neo.org)                                    | Service status page |
| [Discord Community](https://discord.gg/neo)                             | Developer community |
| [Bug Reports](https://github.com/aspect-build/neo-service-layer/issues) | Report issues       |

---

## Version Information

| Component      | Version | Status |
| -------------- | ------- | ------ |
| Service Layer  | v1.0.0  | Stable |
| JavaScript SDK | v1.0.0  | Stable |
| Go SDK         | v0.1.0  | Beta   |
| Python SDK     | v0.1.0  | Beta   |

---

_Last updated: January 2026_
