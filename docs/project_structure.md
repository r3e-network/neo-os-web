# Neo N3 Service Layer Project Structure

## Directory Structure

```
service_layer/
├── cmd/                    # Command-line applications
│   ├── server/             # Main API server
│   └── worker/             # Background worker processes
├── configs/                # Configuration files
├── docs/                   # Documentation
│   ├── architecture/       # Architectural documentation
│   ├── api/                # API documentation
│   └── guides/             # User and developer guides
├── internal/               # Private application code
│   ├── api/                # API handlers
│   ├── blockchain/         # Neo N3 blockchain interface
│   ├── core/               # Core service implementations
│   │   ├── functions/      # Functions service
│   │   ├── secrets/        # Secrets management
│   │   ├── automation/     # Contract automation
│   │   ├── gasbank/        # Gas bank service
│   │   ├── random/         # Random number generation
│   │   ├── pricefeed/      # Price feed service
│   │   └── oracle/         # Oracle service
│   ├── tee/                # TEE integration
│   ├── database/           # Database access layer
│   └── models/             # Data models
├── pkg/                    # Public libraries
│   ├── crypto/             # Cryptography utilities
│   ├── logger/             # Logging framework
│   ├── metrics/            # Metrics collection
│   └── utils/              # General utilities
├── scripts/                # Utility scripts
├── tests/                  # Test suites
│   ├── integration/        # Integration tests
│   ├── performance/        # Performance tests
│   └── security/           # Security tests
├── web/                    # Web assets (dashboard, etc.)
├── go.mod                  # Go module definition
├── go.sum                  # Go module checksum
├── Makefile                # Build automation
├── Dockerfile              # Container definition
├── docker-compose.yml      # Local development environment
└── README.md               # Project overview
```

## Core Packages Description

### cmd
Contains the main entry points for all executable applications in the project.

### internal/api
RESTful API handlers for all service endpoints.

### internal/blockchain
Neo N3 blockchain interaction layer, including smart contract calls and event monitoring.

### internal/core
Core business logic for all services offered by the platform.

### internal/tee
Integration with Azure Confidential Computing for TEE capabilities.

### internal/database
Database access layer for persistent storage.

### pkg
Reusable libraries that could potentially be used by other projects.

## Key Interfaces

### IFunctionService
Interface for the Functions Service, which manages JavaScript function execution.

### ISecretService
Interface for the Secret Management Service, which securely stores and manages user secrets.

### IAutomationService
Interface for the Contract Automation Service, which triggers functions based on various events.

### IGasBankService
Interface for the Gas Bank Service, which manages gas for on-chain transactions.

### IRandomService
Interface for the Random Number Generation Service.

### IPriceFeedService
Interface for the Price Feed Service, which provides regular token price updates.

### IOracleService
Interface for the Oracle Service, which brings external data to the blockchain.

## Database Schema

The service will use PostgreSQL for persistent storage with the following key tables:

- `users`: User information
- `functions`: Stored JavaScript functions
- `secrets`: Encrypted user secrets
- `triggers`: Event triggers for automation
- `transactions`: Record of blockchain transactions
- `price_feeds`: Price feed configurations and history
- `gas_accounts`: Gas bank account information

## External Dependencies

- Neo N3 SDK for Go
- Azure Confidential Computing SDK
- PostgreSQL
- Redis
- Prometheus for metrics
- Grafana for monitoring dashboards