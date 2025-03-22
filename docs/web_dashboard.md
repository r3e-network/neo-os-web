# Neo N3 Service Layer Web Dashboard

## Overview

The Neo N3 Service Layer web dashboard provides a comprehensive user interface for managing all aspects of the service layer. It features a modern, responsive design built with React and Chakra UI, offering intuitive access to all service components.

## Architecture

The dashboard is built with the following technologies:

- **React.js**: Frontend library for building user interfaces
- **Chakra UI**: Component library for building accessible React applications
- **Axios**: HTTP client for API requests
- **Chart.js**: Library for data visualization
- **React Router**: Library for routing within the application
- **React Icons**: Icon library for UI elements

The dashboard follows a modular architecture with:

- **Components**: Reusable UI components
- **Pages**: Main service-specific pages
- **Services**: API integration services
- **Contexts**: Application state management 

## Core Features

### Authentication

The dashboard includes a secure authentication system with:

- Login/logout functionality
- Session management
- Role-based access control
- Secure API token handling

### Main Dashboard

The main dashboard provides an overview of all services with:

- Service status indicators
- Key metrics and statistics
- Quick access to all services
- Recent activity log

### Service-Specific Pages

The dashboard includes dedicated pages for each service:

#### 1. Functions Service

The Functions page allows users to:

- Create, edit, and deploy JavaScript functions
- Test functions with various inputs
- Monitor function executions
- View function logs and metrics
- Set function permissions and configurations

#### 2. Secrets Service

The Secrets page enables users to:

- Store and manage sensitive secrets securely in TEE
- Control access to secrets
- Version secrets
- Rotate secrets as needed
- View secret usage logs

#### 3. Price Feed Service

The Price Feed page provides:

- Real-time price feed monitoring
- Price feed configuration
- Historical price data
- Data source management
- Price feed health metrics

#### 4. Random Number Service

The Random Number service page allows:

- Generation of verifiable random numbers
- Configuration of randomness sources
- Verification of previous random numbers
- Monitoring of random number requests
- Integration examples for smart contracts

#### 5. Oracle Service

The Oracle service page enables:

- Management of data sources for off-chain data
- Monitoring of oracle requests and responses
- Testing of data sources
- Integration with smart contracts
- Oracle service statistics

Key features include:
- Data source creation with multiple source types (HTTP, WebSocket, Blockchain)
- Request history with detailed status tracking
- Smart contract integration examples
- Support for data transformation

#### 6. Gas Bank Service

The Gas Bank service page provides:

- GAS balance management
- Deposit and withdrawal functionality
- Transaction history
- Gas usage statistics by service
- Operation cost estimates

Key features include:
- Easy deposit with QR code and address copying
- Secure withdrawal with address validation
- Detailed transaction history
- Visual gas usage analytics
- Cost estimation for various operations

#### 7. Contract Automation Service

The Contract Automation page enables:

- Creation and management of automation triggers
- Time-based (CRON) trigger configuration
- Price movement trigger configuration
- Blockchain event trigger configuration
- Execution history monitoring
- Contract registration for automation
- Integration examples

## UI Components

### Common Components

The dashboard includes several reusable components:

- **JsonEditor**: Component for editing JSON with validation
- **CodeBlock**: Syntax highlighting component for code examples
- **Navigation**: Sidebar and top navigation components
- **Layout**: Page layout components
- **Charts**: Data visualization components
- **Modals**: Reusable modal components for various actions

### Responsive Design

The dashboard is fully responsive, providing an optimal experience on:

- Desktop screens
- Tablets
- Mobile devices

## API Integration

The dashboard integrates with the backend API through service modules that:

- Handle API requests and responses
- Manage error handling
- Format data for UI consumption
- Maintain consistent API access patterns

## Security Features

Security is a core aspect of the dashboard with:

- HTTPS communication
- Token-based authentication
- API request validation
- Input sanitization
- Session timeout management
- Secure credential handling

## Future Enhancements

Planned enhancements for the web dashboard include:

1. Real-time updates using WebSockets
2. Enhanced user management interface
3. Advanced monitoring and alerting
4. Integration with external monitoring tools
5. Dark mode support
6. Personalization options
7. Expanded analytics capabilities

## User Guides

For detailed usage instructions, please refer to:

- [Functions Service Guide](./functions_service.md)
- [Secrets Service Guide](./secrets_service.md)
- [Price Feed Service Guide](./price_feed_service.md)
- [Random Number Service Guide](./random_number_service.md)
- [Oracle Service Guide](./oracle_service.md)
- [Gas Bank Service Guide](./gas_bank_service.md)
- [Contract Automation Guide](./automation_integration.md) 