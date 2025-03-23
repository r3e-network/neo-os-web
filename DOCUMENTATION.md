# Neo N3 Service Layer Documentation

This document serves as an index to all documentation for the Neo N3 Service Layer project.

## Quick Links

- [README.md](README.md) - Project overview and getting started
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to the project
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community guidelines
- [SECURITY.md](SECURITY.md) - Security policy and reporting vulnerabilities
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [LICENSE](LICENSE) - Project license (MIT)

## Project Documentation

### Overview Documents

- [Architecture Overview](docs/architecture_overview.md) - System architecture
- [Implementation Status](docs/implementation_status/PROGRESS_SUMMARY.md) - Current progress
- [Implementation Plan](docs/implementation_plan.md) - Original plan and progress
- [Compatibility Strategy](docs/COMPATIBILITY.md) - Handling external dependencies
- [Issues and Solutions](docs/SERVICE_LAYER_ISSUES.md) - Common issues and their solutions

### Component Documentation

- [API Documentation](docs/api/api_overview.md) - API endpoints and usage
- [Web Dashboard](docs/web_dashboard.md) - User interface features
- [Transaction Management](docs/transaction_management_system.md) - Blockchain transaction handling
- [Neo N3 Integration](docs/neo_n3_integration.md) - Neo N3 specific features

### Service-Specific Documentation

- [Functions Service](docs/services/functions_service.md) - JavaScript execution in TEE
- [Secrets Management](docs/services/secrets_service.md) - Secure storage of user secrets
- [Oracle Service](docs/services/oracle_service.md) - External data on-chain
- [Price Feed Service](docs/services/price_feed_service.md) - Token price updates
- [Automation Service](docs/services/automation_service.md) - Event-based triggers
- [Random Number Service](docs/services/random_service.md) - Secure random number generation
- [Gas Bank Service](docs/services/gas_bank_service.md) - Gas management for operations

### Security Documentation

- [Security Overview](docs/security/README.md) - Security architecture
- [Rate Limiting](docs/security/RATE_LIMITING.md) - API protection
- [API Key Rotation](docs/security/API_KEY_ROTATION.md) - Key management
- [Audit Logging](docs/security/AUDIT_LOGGING.md) - Security event logging
- [Security Checklist](docs/security/SECURITY_CHECKLIST.md) - Security features implemented
- [Security Testing](docs/security_testing.md) - Approach to security testing
- [Security Automation](docs/security_automation.md) - Automated security testing

### Developer Guides

- [Developer Guide](docs/developer_guide.md) - Guide for developers
- [Integration Example](docs/api/integration_example.md) - Basic integration patterns
- [Automation Integration](docs/automation_integration.md) - Contract automation with Neo N3
- [Oracle Integration](docs/oracle_integration.md) - Oracle service with Neo N3

### DevOps Documentation

- [CI/CD Pipeline](docs/devops/ci_cd_pipeline.md) - Continuous integration and deployment
- [Deployment Guide](docs/devops/deployment_guide.md) - Production deployment
- [Monitoring](docs/devops/monitoring.md) - System monitoring
- [Infrastructure](docs/devops/infrastructure.md) - Infrastructure setup

## Code Examples

- [Examples Directory](examples/) - Usage examples for all services
- [Contract Examples](contracts/) - Sample Neo N3 contracts that integrate with the Service Layer