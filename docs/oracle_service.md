# Oracle Service

## Overview

The Oracle Service brings external data to the Neo N3 blockchain by providing verifiable off-chain data feeds. It securely retrieves, validates, and delivers data from external API sources to smart contracts, enabling blockchain applications to interact with real-world information such as sports results, weather data, financial information, and any other external API data.

## Features

- Retrieval of data from external API sources
- Support for various authentication methods (API keys, OAuth, etc.)
- Data validation and transformation capabilities
- Verifiable data delivery to on-chain contracts
- TEE-based execution for enhanced security
- Historical data storage and querying
- Custom data feed creation and management
- Support for multiple data formats (JSON, XML, CSV)
- Request-response pattern with callback mechanism
- Batched data delivery for efficiency

## Architecture

The Oracle Service consists of the following components:

1. **Data Source Manager**: Manages connections to external data sources
2. **Request Processor**: Handles oracle data requests
3. **Data Validator**: Validates and formats data from external sources
4. **Blockchain Integration**: Delivers data to Neo N3 contracts
5. **Storage Layer**: Records request history and data for auditing
6. **TEE Runner**: Executes data retrieval in a secure environment

## Request Flow

The service follows this basic flow for delivering data:

1. **Request Submission**:
   - Smart contract or user requests data via the API
   - Request includes data source, parameters, and callback information

2. **Data Collection**:
   - Oracle service retrieves data from the specified external source
   - Data is validated and formatted according to request parameters

3. **On-chain Delivery**:
   - Validated data is delivered to the requesting contract
   - Transaction is signed and sent to the blockchain

4. **Verification**:
   - Smart contract can verify the data integrity
   - Data provenance is recorded for auditing

## Data Sources

The service supports multiple types of data sources:

- **REST APIs**: HTTP/HTTPS endpoints with JSON or XML responses
- **WebSockets**: Real-time data streams
- **File Systems**: CSV, JSON, or XML files
- **IPFS**: Decentralized file system
- **Databases**: SQL or NoSQL databases
- **Custom Sources**: Extendable interface for custom data sources

## Authentication Methods

The service supports various authentication methods for external APIs:

- API Key authentication
- OAuth 2.0
- JWT tokens
- Basic authentication
- Custom authentication headers

## Smart Contract Integration

### Example Oracle Consumer Contract (Pseudo-code)

```go
// Oracle consumer contract interface
type OracleConsumer interface {
    // Request data from the oracle service
    RequestData(requestID uint64, url string, path string, callback string) bool
    
    // Callback for receiving the data
    ReceiveData(requestID uint64, data []byte, proof []byte) bool
    
    // Get the last received data
    GetLastData() (data []byte, timestamp uint64)
}
```

## API Endpoints

### Admin API

- `GET /api/v1/oracles` - List all oracle data feeds
- `GET /api/v1/oracles/{id}` - Get details of a specific oracle
- `POST /api/v1/oracles` - Create a new oracle data feed
- `PUT /api/v1/oracles/{id}` - Update an oracle data feed
- `DELETE /api/v1/oracles/{id}` - Delete an oracle data feed
- `GET /api/v1/oracles/{id}/requests` - List requests for an oracle
- `GET /api/v1/oracles/requests/{id}` - Get details of a specific request

### Public API

- `POST /api/v1/public/oracles/request` - Submit a new oracle data request
- `GET /api/v1/public/oracles/request/{id}` - Get the status and result of a request
- `GET /api/v1/public/oracles/data/{id}` - Get historically stored oracle data

## Request Parameters

Oracle requests support the following parameters:

- `url`: The API endpoint URL to fetch data from
- `method`: HTTP method (GET, POST, etc.)
- `headers`: Custom HTTP headers for the request
- `body`: Request body for POST/PUT requests
- `auth_type`: Authentication type (API_KEY, OAUTH, BASIC, etc.)
- `auth_params`: Authentication parameters (keys, tokens, etc.)
- `path`: JSONPath or XPath expression to extract specific data
- `transform`: Transformation function to apply to the data
- `callback_address`: Neo N3 contract address to receive the data
- `callback_method`: Method to call with the data
- `gas_fee`: GAS fee to pay for the callback transaction

## Security Features

- All oracle operations execute within the TEE environment
- Data signatures ensure integrity from source to blockchain
- Rate limiting prevents API abuse and DoS attacks
- Input validation prevents injection attacks
- Secure credential storage for API authentication
- Detailed audit logs for all requests and responses

## Performance Considerations

- Connection pooling for efficient API requests
- Caching of frequently requested data
- Batched blockchain transactions for multiple data points
- Automatic retry mechanisms for failed requests
- Prioritization of time-sensitive requests

## Use Cases

- Financial data feeds (prices, exchange rates, etc.)
- Sports results and statistics
- Weather data and forecasts
- IoT sensor data
- Social media data
- News and events
- Government data
- Supply chain information

## Monitoring and Metrics

The service provides the following metrics:

- Request volume and success rate by data source
- Response time for external APIs
- Data validation success rates
- Gas usage for on-chain operations
- Error rates by source and type
- Request distribution by client

These metrics are exposed via Prometheus and can be visualized in Grafana dashboards.

## Security Considerations

### Data Source Security

- All API endpoints should be HTTPS
- Credentials must be stored securely in the TEE
- Regular rotation of API keys
- Monitoring for unusual access patterns

### On-chain Security

- Data validity checks before submission
- Rate limiting of on-chain transactions
- Contract callback verification
- Gas limit enforcement

## Decentralization Considerations

While the Oracle Service is centralized for efficiency and security, several features promote transparency and reliability:

- Multiple data sources for critical data points
- Verifiable data provenance
- TEE-based execution with attestation
- On-chain verification capability
- Complete audit trail of all oracle operations 