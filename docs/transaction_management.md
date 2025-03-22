# Transaction Management System

## Overview

The Transaction Management System is a critical component of the Neo N3 Service Layer that handles all aspects of blockchain transactions. It provides reliable transaction creation, submission, monitoring, and verification capabilities. The system ensures that all service operations requiring blockchain interaction are properly tracked, optimized for gas usage, and reliably confirmed.

## Features

### Transaction Creation
- Secure wallet management for transaction signing
- Fee estimation and optimization
- Transaction builder with support for all Neo N3 transaction types
- Batching capabilities for optimizing multiple operations
- Parameter validation and error handling

### Transaction Submission
- Reliable submission with retry mechanisms
- Priority-based queue management
- Gas price optimization based on network conditions
- Load balancing across multiple RPC endpoints
- Rate limiting to prevent node overload

### Transaction Monitoring
- Real-time tracking of transaction status
- Configurable confirmation levels
- Event emission for transaction lifecycle events
- Timeout handling and recovery mechanisms

### Transaction Verification
- Receipt validation and storage
- Success/failure determination
- Result extraction and formatting
- Error classification and reporting

### Transaction History
- Comprehensive transaction record keeping
- Filtering and search capabilities
- Export functionality for reporting
- Analytics for usage patterns and optimization opportunities

### Error Handling
- Automatic recovery for common failure modes
- Dead letter queue for manual intervention
- Classification of transaction failures
- User notification system for critical failures

## Architecture

The Transaction Management System consists of several interconnected components:

### Transaction Service
Central service that coordinates all transaction-related operations:
- Exposes APIs for transaction creation and submission
- Manages transaction lifecycle
- Coordinates with other components

### Transaction Repository
Persistent storage for transaction records:
- Stores transaction details, status, and results
- Provides querying capabilities for transaction history
- Maintains relationships with other entities (functions, triggers, etc.)

### Transaction Processor
Background worker that handles transaction submission and monitoring:
- Processes transaction queue
- Implements retry logic and backoff strategies
- Updates transaction status

### Transaction Monitor
Watches the blockchain for transaction confirmations:
- Monitors pending transactions
- Updates transaction status based on blockchain state
- Triggers callbacks and notifications

### Wallet Manager
Securely manages wallets and keys for signing transactions:
- Creates and manages wallets for different services
- Securely stores and accesses private keys
- Implements signing operations in TEE when possible

## Database Schema

### Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    hash VARCHAR(66) UNIQUE,
    service VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    gas_consumed BIGINT,
    gas_price BIGINT NOT NULL,
    system_fee BIGINT NOT NULL,
    network_fee BIGINT NOT NULL,
    block_height BIGINT,
    block_time TIMESTAMP,
    sender VARCHAR(42) NOT NULL,
    error TEXT,
    result JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_service ON transactions(service);
CREATE INDEX idx_transactions_entity ON transactions(entity_id, entity_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

### Transaction Events Table
```sql
CREATE TABLE transaction_events (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    status VARCHAR(20) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_transaction_events_tx_id ON transaction_events(transaction_id);
```

## API Endpoints

### Transaction Management API

#### Create Transaction
```
POST /api/v1/transactions
```
Request:
```json
{
  "service": "price_feed",
  "entityId": "550e8400-e29b-41d4-a716-446655440000",
  "entityType": "feed",
  "type": "invoke",
  "script": "0x...",
  "params": [...],
  "signers": [...],
  "gasPrice": 1000,
  "systemFee": 1000000,
  "networkFee": 1000000,
  "priority": "high"
}
```
Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hash": "0x...",
  "status": "pending",
  "created_at": "2023-03-22T00:00:00Z"
}
```

#### Get Transaction
```
GET /api/v1/transactions/{id}
```
Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hash": "0x...",
  "service": "price_feed",
  "entityId": "550e8400-e29b-41d4-a716-446655440000",
  "entityType": "feed",
  "status": "confirmed",
  "type": "invoke",
  "data": {
    "script": "0x...",
    "params": [...],
    "signers": [...]
  },
  "gasConsumed": 1000000,
  "gasPrice": 1000,
  "systemFee": 1000000,
  "networkFee": 1000000,
  "blockHeight": 12345,
  "blockTime": "2023-03-22T00:01:00Z",
  "sender": "NeoContractAddress",
  "result": {...},
  "created_at": "2023-03-22T00:00:00Z",
  "updated_at": "2023-03-22T00:01:30Z"
}
```

#### List Transactions
```
GET /api/v1/transactions?service={service}&status={status}&entityId={entityId}&page={page}&limit={limit}
```
Response:
```json
{
  "total": 100,
  "page": 1,
  "limit": 10,
  "transactions": [...]
}
```

#### Retry Transaction
```
POST /api/v1/transactions/{id}/retry
```
Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hash": "0x...",
  "status": "pending",
  "updated_at": "2023-03-22T00:05:00Z"
}
```

#### Cancel Transaction
```
POST /api/v1/transactions/{id}/cancel
```
Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "updated_at": "2023-03-22T00:06:00Z"
}
```

## Implementation Details

### Transaction Lifecycle States
1. **Created**: Transaction has been created but not yet submitted
2. **Pending**: Transaction has been submitted to the blockchain
3. **Confirming**: Transaction has been included in a block but waiting for confirmation blocks
4. **Confirmed**: Transaction has been confirmed with the required number of blocks
5. **Failed**: Transaction has failed due to execution error or rejection
6. **Expired**: Transaction has not been included in a block within the timeout period
7. **Cancelled**: Transaction has been cancelled before confirmation

### Error Handling Strategy
1. **Transient Errors**: Network issues, node unavailability
   - Automatic retry with exponential backoff
   - Configurable retry limits

2. **Persistent Errors**: Validation errors, insufficient gas
   - Immediate failure reporting
   - Detailed error information for debugging

3. **Ambiguous Errors**: Timeout, unconfirmed status
   - Transaction resubmission with higher fees
   - Notification for manual intervention if necessary

### Gas Optimization
1. Gas price adjustment based on network congestion
2. Batching of related operations when possible
3. Gas estimation before submission to ensure success
4. Gas usage analytics to optimize transaction patterns

### Monitoring and Alerting
1. Transaction success rate monitoring
2. Alert on high failure rates
3. Alert on transaction queue growth
4. Alert on unusually high gas prices
5. Dashboard for transaction health metrics

## Integration with Other Services

### Price Feed Service
- Submits price update transactions
- Monitors transaction confirmation for successful updates
- Uses transaction service for batching multiple price updates

### Oracle Service
- Submits data response transactions
- Tracks transaction status for callback handling
- Manages transaction prioritization for timely data delivery

### Random Number Service
- Submits commit and reveal transactions
- Ensures timely confirmation of random number generation phases
- Uses transaction service for secure handling of random values

### Contract Automation
- Submits contract invocation transactions based on triggers
- Monitors transaction status for trigger completion
- Manages retry policies for failed transactions

### Functions Service
- Submits function result transactions
- Tracks transaction status for execution completion
- Uses transaction service for gas estimation and optimization

## Performance Considerations

1. **Scalability**
   - Horizontal scaling of transaction processors
   - Efficient database indexing for transaction queries
   - Caching of frequently accessed transaction data

2. **Throughput**
   - Queue-based architecture for handling transaction spikes
   - Prioritization to ensure critical transactions are processed first
   - Batching to optimize blockchain interaction

3. **Latency**
   - Optimize confirmation monitoring for faster status updates
   - Multiple RPC endpoints for redundancy and load distribution
   - Efficient retry mechanisms to minimize delay on failure

## Security Considerations

1. **Key Management**
   - Secure storage of private keys in TEE
   - Separation of signing authority by service
   - Regular key rotation policies

2. **Access Control**
   - Fine-grained permissions for transaction operations
   - Audit logging of all transaction-related actions
   - Verification of transaction origin and authorization

3. **Gas Management**
   - Limits on gas usage to prevent resource exhaustion
   - Monitoring for unusual gas consumption patterns
   - Protection against fee spikes and network attacks

## Future Enhancements

1. Support for advanced Neo N3 transaction types
2. Integration with hardware security modules for additional key protection
3. Enhanced analytics for gas usage optimization
4. Advanced batching strategies for related operations
5. Support for sponsored transactions (fee delegation)

## Testing Strategy

1. **Unit Tests**
   - Test individual components of the transaction system
   - Mock external dependencies for isolation
   - Validate error handling and retry logic

2. **Integration Tests**
   - Test interaction with the Neo N3 blockchain on testnet
   - Verify transaction lifecycle state transitions
   - Test integration with other services

3. **Performance Tests**
   - Measure transaction throughput under load
   - Test behavior under network congestion scenarios
   - Validate scaling capabilities with high transaction volumes

4. **Security Tests**
   - Verify key management and protection
   - Test access control mechanisms
   - Validate transaction signing integrity 