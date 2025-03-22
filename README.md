# Neo N3 Service Layer

A centralized oracle service for the Neo N3 blockchain, providing functions execution in TEE, contract automation, price feeds, and more.

## Features

- **Functions Service**: JavaScript functions execution in a Trusted Execution Environment (TEE)
- **Secret Management**: Secure storage and usage of user secrets
- **Contract Automation**: Event-based triggers for smart contract functions
- **Gas Bank**: Efficient gas management for service operations
- **Random Number Generation**: Secure random number generation for contracts
- **Price Feed**: Regular on-chain token price updates
- **Oracle Service**: Bringing external data to Neo N3 blockchain

## Architecture

The Neo N3 Service Layer is built on Azure Confidential Computing for TEE capabilities and uses a modular architecture:

- **API Layer**: RESTful endpoints for user interaction
- **Core Services**: Business logic for all features
- **TEE Environment**: Secure execution of user functions and storage of secrets
- **Neo N3 Blockchain Interface**: Communication with Neo N3 blockchain
- **Web Dashboard**: Comprehensive user interface for service management

## Current Development Status

The project is nearly complete with all core functionality implemented. We have successfully completed:

- Core services implementation (Functions, Secrets, Automation, Oracle, Price Feed, Random Number, Gas Bank)
- TEE integration with Azure Confidential Computing
- Transaction Management System for reliable blockchain interaction
- Web Dashboard with comprehensive user interfaces for all services
- API integration for all service components
- Neo N3 blockchain interface and smart contract integration

For a detailed view of the implementation status and next steps, see:
- [Implementation Status](docs/implementation_status.md) - Current progress
- [Implementation Summary](docs/implementation_summary.md) - Summary of completed work
- [Implementation Plan](docs/implementation_plan.md) - Original plan and progress

## Getting Started

### Prerequisites

- Go 1.22 or higher
- Docker and Docker Compose
- PostgreSQL 14 or higher
- Redis 6 or higher
- Azure account with Confidential Computing capabilities
- Node.js 18+ and npm for web dashboard

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/willtech-services/service_layer.git
   cd service_layer
   ```

2. Install dependencies:
   ```
   go mod download
   cd web && npm install && cd ..
   ```

3. Set up environment variables:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development environment:
   ```
   docker-compose up -d
   ```

5. Run database migrations:
   ```
   make migrate-up
   ```

6. Start the server and web dashboard:
   ```
   make run-all
   ```

## Development

### Project Structure

```
service_layer/
├── cmd/                    # Command-line applications
├── configs/                # Configuration files
├── contracts/              # Sample Neo N3 contracts
├── docs/                   # Documentation
├── internal/               # Private application code
│   ├── api/                # API handlers and routes
│   ├── config/             # Configuration structures
│   ├── core/               # Core business logic
│   ├── db/                 # Database access
│   ├── models/             # Data models
│   └── tee/                # TEE integration
├── pkg/                    # Public libraries
├── scripts/                # Utility scripts
├── tests/                  # Test suites
└── web/                    # Web dashboard application
    ├── public/             # Static assets
    └── src/                # React application code
        ├── components/     # Reusable UI components
        ├── pages/          # Service-specific pages
        └── services/       # API integration services
```

### Running Tests

```
make test
```

### Building for Production

```
make build
```

## Documentation

The project includes comprehensive documentation:

- [Architecture Overview](docs/architecture_overview.md) - System architecture
- [Transaction Management System](docs/transaction_management_system.md) - Blockchain transaction handling
- [Web Dashboard](docs/web_dashboard.md) - User interface features
- [API Documentation](docs/api/api_overview.md) - API endpoints and usage
- [Neo N3 Integration](docs/neo_n3_integration.md) - Neo N3 specific features
- [Developer Guide](docs/developer_guide.md) - Guide for developers

## Web Dashboard

The web dashboard provides a comprehensive user interface for all services:

- Functions management and execution
- Secrets storage and management
- Oracle data source configuration
- Price feed monitoring and configuration
- Random number generation and verification
- Gas bank balance and transaction management
- Contract automation trigger management

Access the dashboard at `http://localhost:3000` when running in development mode.

## API Documentation

API documentation is available at `/swagger/index.html` when the server is running. You can also find detailed API specifications in the [docs/api](docs/api) directory.

## Smart Contract Integration

For examples of how to integrate Neo N3 smart contracts with the Service Layer, see the following documentation:

- [Integration Example](docs/api/integration_example.md) - Basic integration patterns
- [Automation Integration](docs/automation_integration.md) - Contract automation with Neo N3
- [Oracle Integration](docs/oracle_integration.md) - Oracle service with Neo N3

Sample contracts can be found in the [contracts](contracts) directory.

## Security

The Neo N3 Service Layer prioritizes security:

- All sensitive operations occur within the TEE
- User secrets are encrypted and only accessible within the TEE
- Authentication and authorization for all API endpoints
- Regular security audits and updates
- Secure transaction management for blockchain interactions

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Neo N3 Blockchain](https://neo.org/)
- [Azure Confidential Computing](https://azure.microsoft.com/en-us/solutions/confidential-compute/)
- [Go Programming Language](https://golang.org/)
- [React](https://reactjs.org/)
- [Chakra UI](https://chakra-ui.com/)