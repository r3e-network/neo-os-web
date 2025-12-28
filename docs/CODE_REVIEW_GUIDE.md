# Service Layer Code Review Guide

This document provides structured instructions for Codex to perform a comprehensive module-by-module code review of the Service Layer project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Review Principles](#review-principles)
3. [Module Review Instructions](#module-review-instructions)
    - [Services](#1-services)
    - [Infrastructure](#2-infrastructure)
    - [Contracts](#3-contracts)
    - [Platform](#4-platform)
    - [Configuration](#5-configuration)
4. [Review Checklist](#review-checklist)
5. [Output Format](#output-format)

---

## Project Overview

The Service Layer is a TEE-based (Trusted Execution Environment) platform for Neo N3 blockchain that provides:

- **Confidential Computing**: Services run inside MarbleRun enclaves
- **MiniApp Platform**: Gaming, DeFi, Social, and Governance applications
- **Account Pool**: Managed wallet infrastructure for automated transactions
- **Price Feeds**: Real-time price data from multiple sources
- **VRF**: Verifiable Random Function for provably fair randomness
- **Automation**: Scheduled task execution and workflow automation

### Tech Stack

- **Backend**: Go 1.21+
- **Smart Contracts**: C# (Neo N3)
- **Frontend**: TypeScript, React
- **TEE**: MarbleRun (EGo framework)
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Neo N3

---

## Review Principles

### SOLID Principles

- **S**ingle Responsibility: Each module/function should have one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes must be substitutable for base types
- **I**nterface Segregation: Many specific interfaces over one general interface
- **D**ependency Inversion: Depend on abstractions, not concretions

### Additional Principles

- **KISS**: Keep It Simple, Stupid
- **DRY**: Don't Repeat Yourself
- **YAGNI**: You Aren't Gonna Need It

### Security Focus Areas

- Input validation and sanitization
- Authentication and authorization
- Secret management (no hardcoded secrets)
- TEE attestation and verification
- Smart contract security patterns

---

## Module Review Instructions

### 1. Services

Location: `services/`

#### 1.1 Simulation Service (`services/simulation/`)

**Purpose**: Continuous transaction simulation for MiniApps to generate realistic on-chain activity.

**Key Files to Review**:

```
services/simulation/marble/
├── service.go           # Main service entry point
├── service_test.go      # Service tests
├── config.go            # Configuration handling
├── contracts.go         # Contract invocation logic
├── miniapp_simulator.go # MiniApp workflow simulation
├── simulator_gaming.go  # Gaming MiniApp simulators
├── simulator_defi.go    # DeFi MiniApp simulators
├── simulator_social.go  # Social MiniApp simulators
├── simulator_other.go   # Other MiniApp simulators
└── simulator_types.go   # Shared types and utilities
```

**Review Focus**:

1. **Contract Invocation Flow**:
    - Verify `ContractInvoker` properly manages pool accounts
    - Check error handling in `InvokeMiniAppContract`
    - Validate contract hash loading from environment

2. **Simulator Logic**:
    - Each simulator should follow the pattern: Payment -> Contract Call -> Payout
    - Verify random number generation is cryptographically secure
    - Check for proper context cancellation handling

3. **Resource Management**:
    - Account locking/unlocking mechanism
    - Memory leaks in long-running goroutines
    - Proper cleanup on shutdown

**Codex Prompt**:

```
Review services/simulation/marble/*.go for:
1. Error handling completeness - are all errors properly logged or returned?
2. Goroutine safety - are shared resources properly protected with mutexes?
3. Contract invocation patterns - do all simulators follow consistent patterns?
4. Resource cleanup - are accounts released on shutdown?
5. Configuration validation - are required env vars checked at startup?
```

#### 1.2 Automation Service (`services/automation/`)

**Purpose**: Scheduled task execution and workflow automation.

**Key Files**:

```
services/automation/marble/
├── service.go
├── anchored_tasks.go    # On-chain anchored automation
└── scheduler.go         # Task scheduling logic
```

**Review Focus**:

1. Task scheduling accuracy and reliability
2. On-chain anchor verification
3. Retry logic and failure handling
4. Gas estimation and management

#### 1.3 Data Feed Service (`services/datafeed/`)

**Purpose**: Price feed aggregation and on-chain publishing.

**Review Focus**:

1. Price source reliability and fallback
2. Data validation and outlier detection
3. On-chain update frequency and gas optimization
4. TEE attestation for price data

#### 1.4 VRF Service (`services/vrf/`)

**Purpose**: Verifiable Random Function for provably fair randomness.

**Review Focus**:

1. VRF proof generation correctness
2. Seed handling and entropy sources
3. Request/response lifecycle
4. Replay attack prevention

#### 1.5 Requests Service (`services/requests/`)

**Purpose**: Service request routing and fulfillment.

**Review Focus**:

1. Request validation and sanitization
2. Service routing logic
3. Response formatting and error handling
4. Rate limiting and abuse prevention

#### 1.6 TxProxy Service (`services/txproxy/`)

**Purpose**: Transaction signing and submission proxy.

**Review Focus**:

1. Transaction allowlist enforcement
2. Signing key management
3. Nonce management and collision prevention
4. Gas price estimation

#### 1.7 GasBank Service (`services/gasbank/`)

**Purpose**: GAS token management and distribution.

**Review Focus**:

1. Balance tracking accuracy
2. Top-up logic and thresholds
3. Withdrawal security
4. Audit trail completeness

---

### 2. Infrastructure

Location: `infrastructure/`

#### 2.1 Account Pool (`infrastructure/accountpool/`)

**Purpose**: Managed wallet pool for automated transactions.

**Key Files**:

```
infrastructure/accountpool/
├── service/
│   ├── service.go       # Pool service implementation
│   ├── pool.go          # Account pool management
│   └── master.go        # Master wallet operations
├── client/
│   └── client.go        # Pool client for other services
└── types/
    └── types.go         # Shared types
```

**Review Focus**:

1. **Key Management**:
    - Master key derivation security
    - Account key encryption at rest
    - Key rotation support

2. **Pool Operations**:
    - Account allocation fairness
    - Lock/unlock atomicity
    - Balance tracking accuracy

3. **Client Interface**:
    - API completeness
    - Error handling
    - Timeout handling

#### 2.2 Chain Infrastructure (`infrastructure/chain/`)

**Purpose**: Neo N3 blockchain interaction utilities.

**Review Focus**:

1. RPC client reliability and failover
2. Transaction building correctness
3. Event parsing accuracy
4. Block confirmation handling

#### 2.3 Global Signer (`infrastructure/globalsigner/`)

**Purpose**: Centralized signing service with domain separation.

**Review Focus**:

1. Domain separation correctness
2. Key derivation security
3. Signing request validation
4. Audit logging

#### 2.4 Secrets Management (`infrastructure/secrets/`)

**Purpose**: Encrypted secret storage and retrieval.

**Review Focus**:

1. Encryption algorithm strength
2. Key derivation from master key
3. Access control enforcement
4. Secret rotation support

#### 2.5 Database (`infrastructure/database/`)

**Purpose**: Database connection and query utilities.

**Review Focus**:

1. Connection pooling configuration
2. Query parameterization (SQL injection prevention)
3. Transaction handling
4. Migration management

---

### 3. Contracts

Location: `contracts/`

#### 3.1 Platform Contracts

**Key Contracts**:

```
contracts/
├── AppRegistry/         # MiniApp registration and management
├── PaymentHub/          # Payment processing and routing
├── Governance/          # Platform governance
├── ServiceLayerGateway/ # Service request gateway
├── AutomationAnchor/    # Automation task anchoring
└── PauseRegistry/       # Emergency pause functionality
```

**Review Focus**:

1. **Access Control**:
    - Owner/admin role separation
    - TEE signer verification
    - Permission inheritance

2. **State Management**:
    - Storage layout efficiency
    - State transition correctness
    - Event emission completeness

3. **Security Patterns**:
    - Reentrancy protection
    - Integer overflow/underflow
    - Input validation

#### 3.2 MiniApp Contracts

**Categories**:

- **Gaming**: Lottery, CoinFlip, DiceGame, ScratchCard, GasSpin, SecretPoker, FogChess
- **DeFi**: PredictionMarket, FlashLoan, PriceTicker, PricePredict, TurboOptions, ILGuard, AITrader, GridBot
- **Social**: RedEnvelope, GasCircle, SecretVote, NFTEvolve
- **Governance**: GovBooster, BridgeGuardian, GuardianPolicy

**Review Focus per Contract**:

1. **Business Logic**:
    - Game mechanics correctness
    - Payout calculations
    - Edge case handling

2. **Integration**:
    - PaymentHub integration
    - VRF/Oracle consumption
    - Event emission for frontend

3. **Security**:
    - Randomness source verification
    - Front-running prevention
    - Fund safety

**Codex Prompt for Contracts**:

```
Review contracts/MiniApp{Name}/{Name}.cs for:
1. Does it inherit from MiniAppBase correctly?
2. Are all public methods properly access-controlled?
3. Is randomness sourced from VRF (not block hash)?
4. Are payouts calculated correctly with no overflow?
5. Are all state changes emitted as events?
6. Is there proper validation of all inputs?
```

---

### 4. Platform

Location: `platform/`

#### 4.1 SDK (`platform/sdk/`)

**Purpose**: TypeScript SDK for MiniApp development.

**Key Files**:

```
platform/sdk/src/
├── client.ts            # Main SDK client
├── types.ts             # TypeScript type definitions
├── payment.ts           # Payment utilities
└── events.ts            # Event subscription
```

**Review Focus**:

1. API completeness and consistency
2. Type safety and validation
3. Error handling and user feedback
4. Documentation accuracy

#### 4.2 Edge Functions (`platform/edge/`)

**Purpose**: Supabase Edge Functions for serverless operations.

**Review Focus**:

1. Authentication and authorization
2. Input validation
3. Rate limiting
4. Error response formatting

#### 4.3 Host App (`platform/host-app/`)

**Purpose**: Main platform web application.

**Review Focus**:

1. Component architecture
2. State management
3. API integration
4. Security (XSS, CSRF prevention)

#### 4.4 Admin Console (`platform/admin-console/`)

**Purpose**: Administrative interface for platform management.

**Review Focus**:

1. Role-based access control
2. Audit logging
3. Sensitive operation confirmation
4. Data export security

---

### 5. Configuration

#### 5.1 Docker Configuration (`docker/`)

**Key Files**:

```
docker/
├── docker-compose.simulation.yaml  # Simulation environment
├── docker-compose.yaml             # Production environment
└── Dockerfile.service              # Service container build
```

**Review Focus**:

1. Environment variable handling
2. Secret injection (no hardcoded values)
3. Network isolation
4. Resource limits

#### 5.2 MarbleRun Manifests (`manifests/`)

**Key Files**:

```
manifests/
└── manifest.json        # MarbleRun enclave configuration
```

**Review Focus**:

1. Package signer verification
2. Secret provisioning
3. Environment variable injection
4. TCB status acceptance policy

#### 5.3 Kubernetes Configuration (`k8s/`)

**Review Focus**:

1. Resource requests and limits
2. Security contexts
3. Network policies
4. Secret management

---

## Review Checklist

### General Code Quality

- [ ] No hardcoded secrets or credentials
- [ ] Proper error handling (no silent failures)
- [ ] Consistent logging with appropriate levels
- [ ] Unit tests with >80% coverage
- [ ] Documentation for public APIs

### Go-Specific

- [ ] Context propagation for cancellation
- [ ] Proper goroutine lifecycle management
- [ ] Race condition prevention (mutex usage)
- [ ] Defer for resource cleanup
- [ ] Error wrapping with context

### Smart Contract-Specific

- [ ] Access control on all state-changing methods
- [ ] Event emission for all state changes
- [ ] Input validation on all public methods
- [ ] Safe math operations
- [ ] Reentrancy protection where needed

### Security

- [ ] Input validation and sanitization
- [ ] Authentication on protected endpoints
- [ ] Authorization checks before operations
- [ ] Audit logging for sensitive operations
- [ ] Rate limiting on public endpoints

---

## Output Format

When reviewing each module, provide output in this format:

```markdown
## Module: [Module Name]

### Summary

[Brief description of what was reviewed]

### Findings

#### Critical Issues

- [Issue description with file:line reference]
- [Suggested fix]

#### High Priority

- [Issue description with file:line reference]
- [Suggested fix]

#### Medium Priority

- [Issue description with file:line reference]
- [Suggested fix]

#### Low Priority / Suggestions

- [Improvement suggestion]

### Code Quality Metrics

- Test Coverage: [X%]
- Cyclomatic Complexity: [Average]
- Documentation: [Complete/Partial/Missing]

### Recommendations

1. [Prioritized recommendation]
2. [Prioritized recommendation]
```

---

## Execution Order

For a complete project review, execute in this order:

1. **Infrastructure** (foundation layer)
    - accountpool -> globalsigner -> chain -> secrets -> database

2. **Services** (business logic layer)
    - txproxy -> gasbank -> vrf -> datafeed -> requests -> automation -> simulation

3. **Contracts** (smart contract layer)
    - Platform contracts -> MiniApp contracts

4. **Platform** (frontend layer)
    - SDK -> Edge Functions -> Host App -> Admin Console

5. **Configuration** (deployment layer)
    - Docker -> Manifests -> Kubernetes

---

## Quick Start Commands

### Review Single Module

```bash
# Review simulation service
codex "Review services/simulation/marble/*.go following docs/CODE_REVIEW_GUIDE.md"

# Review specific contract
codex "Review contracts/MiniAppLottery/MiniAppLottery.cs following docs/CODE_REVIEW_GUIDE.md"
```

### Review All Services

```bash
codex "Review all services in services/ directory following docs/CODE_REVIEW_GUIDE.md, output findings per service"
```

### Security-Focused Review

```bash
codex "Perform security-focused review of infrastructure/accountpool/ and infrastructure/globalsigner/ following docs/CODE_REVIEW_GUIDE.md"
```
