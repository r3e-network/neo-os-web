# Transaction Monitoring System

## Overview

The Transaction Monitoring System is a critical component of the Neo N3 Service Layer that ensures reliable tracking and verification of all blockchain transactions. It's designed to handle various failure scenarios, network partitions, and provide robust recovery mechanisms.

## Architecture

The monitoring system follows a layered approach:

```
┌─────────────────────────────────────────────────────────┐
│                 Transaction Service                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐    ┌───────────────┐    ┌─────────┐  │
│  │ Transaction   │    │ Transaction   │    │ Health  │  │
│  │ Tracker       │    │ Resubmitter   │    │ Monitor │  │
│  └───────────────┘    └───────────────┘    └─────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                  Blockchain Client                       │
├─────────────────────────────────────────────────────────┤
│                   Neo N3 Network                         │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### Transaction Tracker

The Transaction Tracker is responsible for monitoring the status of all pending transactions:

- **Lifecycle Management**: Tracks transactions through all states (created, submitted, pending, confirming, confirmed, failed, expired)
- **In-Memory Cache**: Maintains an in-memory cache of active transactions for fast lookups
- **Database Synchronization**: Periodically synchronizes with the database to ensure no transactions are lost
- **State Machine**: Implements a state machine pattern for transaction status transitions

### Transaction Resubmitter

The Transaction Resubmitter handles the automatic retry of failed or stuck transactions:

- **Selective Retry**: Only retries transactions that need intervention based on age and status
- **Mempool Validation**: Checks if transactions are in the mempool before deciding on retry
- **Adaptive Backoff**: Implements exponential backoff for retries based on failure patterns
- **Transaction Reconstruction**: Rebuilds transactions when needed for resubmission

### Health Monitor

The Health Monitor ensures the reliability of the blockchain connection:

- **Node Health Checks**: Regularly checks node health to detect issues early
- **Network Partition Detection**: Identifies potential network partitions
- **Node Prioritization**: Prioritizes nodes based on latency and reliability
- **Connection Reset**: Forces connection resets when persistent issues are detected

## Implementation Details

### Transaction State Flow

Transactions follow a well-defined state flow:

1. **Created**: Transaction is created in the database with initial parameters
2. **Submitted**: Transaction has been submitted to the blockchain network
3. **Pending**: Transaction is in the mempool awaiting inclusion in a block
4. **Confirming**: Transaction is included in a block but hasn't reached confirmation threshold
5. **Confirmed**: Transaction has reached the required number of confirmations
6. **Failed**: Transaction failed to execute successfully
7. **Expired**: Transaction was not included in a block within timeout period

### Transaction Events

Each state transition is recorded as a transaction event, providing a complete audit trail:

```go
// Sample event structure
event := &models.TransactionEvent{
    ID:            uuid.New(),
    TransactionID: tx.ID,
    Status:        models.TransactionStatusConfirmed,
    Details:       json.RawMessage(fmt.Sprintf(`{"blockHeight":%d,"gasConsumed":%d}`, blockHeight, gasConsumed)),
    Timestamp:     time.Now(),
}
```

### Recovery Mechanisms

The system implements several recovery mechanisms:

1. **Transaction Resubmission**: Automatically resubmits transactions that haven't been included in the mempool
2. **Node Failover**: Switches to alternate nodes when primary nodes fail
3. **Database Reconciliation**: Regularly reconciles in-memory state with database records
4. **Timeout Handling**: Expires transactions that have been pending for too long

### Network Partition Handling

To handle network partitions, the system:

1. Detects potential partitions based on error patterns
2. Forces reconnection to all nodes
3. Implements a circuit breaker to prevent cascading failures
4. Maintains service degradation gracefully during partial failures

## Configuration Options

The Transaction Monitoring System is highly configurable:

```yaml
monitoring:
  # Monitoring intervals
  check_interval: 30s
  reload_interval: 5m
  health_check_interval: 2m
  
  # Transaction timeouts
  submission_timeout: 5m
  pending_timeout: 60m
  
  # Confirmation settings
  confirmations_required: 1
  
  # Recovery settings
  max_retry_attempts: 3
  node_blacklist_duration: 5m
```

## Usage Example

```go
// Start transaction monitoring
transactionService.StartMonitoring(context.Background())

// Create and submit a transaction
tx, err := transactionService.CreateTransaction(ctx, models.CreateTransactionRequest{
    Service:    "oracle",
    EntityID:   uuid.New(),
    EntityType: "oracle_update",
    Type:       models.TransactionTypeInvoke,
    Data:       invokeData,
})

// Transaction will be monitored automatically until confirmed or failed
```

## Error Handling

The system categorizes errors into several types:

1. **Temporary Network Errors**: Automatically retried
2. **Node Failures**: Trigger node failover
3. **Transaction Execution Errors**: Marked as failed with detailed error information
4. **System Errors**: Logged and alerted to administrators

## Performance Considerations

The Transaction Monitoring System is designed for performance:

- Uses an in-memory cache for active transactions
- Implements batched database operations
- Features configurable monitoring intervals
- Uses goroutines for parallel transaction checking
- Implements priority-based processing for time-sensitive transactions

## Integration with Other Services

The Transaction Monitoring System integrates with:

- **Oracle Service**: For reliable oracle data submission
- **Price Feed Service**: For timely price updates
- **Automation Service**: For reliable contract automation
- **Gas Bank**: For transaction fee management
- **Database**: For persistent transaction storage
- **Logging**: For comprehensive audit trails

## Monitoring and Metrics

The system exposes several metrics for monitoring:

- Transaction success/failure rates
- Average confirmation times
- Node health statistics
- Retry frequencies
- Gas consumption patterns

These metrics are essential for system health monitoring and optimization. 