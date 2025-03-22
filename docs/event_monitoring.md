# Neo N3 Event Monitoring System

This document outlines the Event Monitoring System for the Neo N3 Service Layer, which allows monitoring blockchain events and triggering actions based on those events.

## Overview

The Event Monitoring System provides the following capabilities:

1. Monitoring Neo N3 blockchain for various events
2. Subscribing to events from specific contracts or network-wide
3. Filtering events based on custom criteria
4. Triggering actions when specific events are detected
5. Storing historical events for analysis and auditing
6. Providing notification mechanisms for events

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                Event Monitoring System               │
│                                                     │
│  ┌───────────────┐      ┌───────────────────────┐   │
│  │ Event Listener│      │ Event Processor       │   │
│  └───────────────┘      └───────────────────────┘   │
│                                                     │
│  ┌───────────────┐      ┌───────────────────────┐   │
│  │ Subscription  │      │ Event Store           │   │
│  │ Manager       │      │                       │   │
│  └───────────────┘      └───────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
              │                       │
              ▼                       ▼
┌────────────────────┐    ┌────────────────────────┐
│  Neo N3 Blockchain │    │  Contract Automation   │
└────────────────────┘    └────────────────────────┘
```

## Components

### Event Listener

The Event Listener continuously monitors the Neo N3 blockchain for events. It:

- Connects to Neo N3 nodes via WebSocket or RPC
- Monitors new blocks as they are added to the blockchain
- Extracts events from transaction execution results
- Filters events based on subscription criteria
- Queues events for processing by the Event Processor

### Event Processor

The Event Processor handles events received from the Event Listener. It:

- Processes events in the queue
- Applies additional filtering and validation
- Enriches events with additional context
- Triggers actions based on event data
- Stores events in the Event Store
- Notifies subscribers about matched events

### Subscription Manager

The Subscription Manager handles event subscriptions. It:

- Manages user subscriptions to blockchain events
- Supports subscription by contract address, event type, or parameters
- Provides subscription lifecycle management (create, update, delete)
- Validates subscription parameters
- Maps subscriptions to subscribers for notification routing

### Event Store

The Event Store provides persistent storage for blockchain events. It:

- Stores all monitored events with their details
- Indexes events for efficient querying
- Provides APIs for historical data analysis
- Supports data retention policies
- Enables event replay for debugging

## Event Types

The Event Monitoring System supports the following types of events:

1. **Contract Notification Events**: Events emitted by smart contracts using the notification mechanism
2. **Contract Execution Events**: Events related to contract method invocations
3. **Transaction Events**: Events related to transaction execution (success, failure)
4. **Block Events**: Events related to new blocks being added to the blockchain
5. **State Change Events**: Events related to state changes in the blockchain

## Subscription Model

Users can subscribe to events using the following parameters:

- **Contract Address**: The address of the contract to monitor
- **Event Name**: The name of the event to monitor
- **Event Parameters**: Specific parameter values to filter events
- **Block Range**: The range of blocks to monitor (past, future, or both)
- **Callback URL**: A webhook URL to call when matching events are detected
- **Notification Type**: How to notify when events occur (webhook, email, in-app)

## API Reference

### Subscribe to Events

```
POST /api/v1/events/subscribe
```

Request Body:
```json
{
  "name": "My Subscription",
  "description": "Monitor token transfers",
  "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "eventName": "Transfer",
  "parameters": {
    "from": "0xabcdef1234567890abcdef1234567890abcdef12",
    "to": "*"
  },
  "startBlock": "latest",
  "endBlock": null,
  "callbackUrl": "https://example.com/webhook",
  "notificationType": "webhook"
}
```

Response:
```json
{
  "id": "subscription-uuid",
  "status": "active",
  "created": "2023-01-01T00:00:00Z"
}
```

### Get Subscription

```
GET /api/v1/events/subscriptions/{id}
```

Response:
```json
{
  "id": "subscription-uuid",
  "name": "My Subscription",
  "description": "Monitor token transfers",
  "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "eventName": "Transfer",
  "parameters": {
    "from": "0xabcdef1234567890abcdef1234567890abcdef12",
    "to": "*"
  },
  "startBlock": 1000000,
  "endBlock": null,
  "callbackUrl": "https://example.com/webhook",
  "notificationType": "webhook",
  "status": "active",
  "created": "2023-01-01T00:00:00Z",
  "lastTriggered": "2023-01-02T00:00:00Z",
  "triggerCount": 5
}
```

### List Subscriptions

```
GET /api/v1/events/subscriptions
```

Response:
```json
{
  "subscriptions": [
    {
      "id": "subscription-uuid-1",
      "name": "My Subscription 1",
      "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "eventName": "Transfer",
      "status": "active",
      "created": "2023-01-01T00:00:00Z",
      "triggerCount": 5
    },
    {
      "id": "subscription-uuid-2",
      "name": "My Subscription 2",
      "contractAddress": "0x9876543210abcdef1234567890abcdef12345678",
      "eventName": "Approval",
      "status": "active",
      "created": "2023-01-02T00:00:00Z",
      "triggerCount": 2
    }
  ],
  "total": 2
}
```

### Update Subscription

```
PUT /api/v1/events/subscriptions/{id}
```

Request Body:
```json
{
  "name": "Updated Subscription Name",
  "description": "Updated description",
  "parameters": {
    "from": "*",
    "to": "0xabcdef1234567890abcdef1234567890abcdef12"
  },
  "callbackUrl": "https://example.com/new-webhook",
  "notificationType": "webhook"
}
```

Response:
```json
{
  "id": "subscription-uuid",
  "status": "active",
  "updated": "2023-01-03T00:00:00Z"
}
```

### Delete Subscription

```
DELETE /api/v1/events/subscriptions/{id}
```

Response:
```json
{
  "success": true
}
```

### Get Events

```
GET /api/v1/events
```

Query Parameters:
- `contractAddress`: Filter by contract address
- `eventName`: Filter by event name
- `fromBlock`: Filter events from this block
- `toBlock`: Filter events to this block
- `limit`: Limit number of events returned
- `offset`: Offset for pagination

Response:
```json
{
  "events": [
    {
      "id": "event-uuid-1",
      "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "eventName": "Transfer",
      "parameters": {
        "from": "0xabcdef1234567890abcdef1234567890abcdef12",
        "to": "0x9876543210abcdef1234567890abcdef12345678",
        "amount": "1000000000000000000"
      },
      "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "blockNumber": 1000000,
      "blockHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "timestamp": "2023-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

## Database Schema

### Event Subscriptions Table

| Column              | Type      | Description                            |
|---------------------|-----------|----------------------------------------|
| id                  | UUID      | Unique subscription identifier         |
| user_id             | INTEGER   | User who created the subscription      |
| name                | VARCHAR   | Subscription name                      |
| description         | TEXT      | Subscription description               |
| contract_address    | VARCHAR   | Contract address to monitor            |
| event_name          | VARCHAR   | Event name to monitor                  |
| parameters          | JSONB     | Event parameters to filter             |
| start_block         | INTEGER   | Starting block for monitoring          |
| end_block           | INTEGER   | Ending block for monitoring            |
| callback_url        | VARCHAR   | Webhook URL for notifications          |
| notification_type   | VARCHAR   | Type of notification                   |
| status              | VARCHAR   | Subscription status                    |
| created_at          | TIMESTAMP | Creation timestamp                     |
| updated_at          | TIMESTAMP | Last update timestamp                  |
| last_triggered_at   | TIMESTAMP | Last trigger timestamp                 |
| trigger_count       | INTEGER   | Number of times triggered              |

### Blockchain Events Table

| Column              | Type      | Description                            |
|---------------------|-----------|----------------------------------------|
| id                  | UUID      | Unique event identifier                |
| contract_address    | VARCHAR   | Contract address that emitted the event|
| event_name          | VARCHAR   | Event name                             |
| parameters          | JSONB     | Event parameters                       |
| transaction_hash    | VARCHAR   | Transaction hash                       |
| block_number        | INTEGER   | Block number                           |
| block_hash          | VARCHAR   | Block hash                             |
| timestamp           | TIMESTAMP | Event timestamp                        |
| created_at          | TIMESTAMP | Creation timestamp                     |

### Event Notifications Table

| Column              | Type      | Description                            |
|---------------------|-----------|----------------------------------------|
| id                  | UUID      | Unique notification identifier         |
| subscription_id     | UUID      | Reference to subscription              |
| event_id            | UUID      | Reference to event                     |
| status              | VARCHAR   | Notification status                    |
| delivery_attempts   | INTEGER   | Number of delivery attempts            |
| last_attempt_at     | TIMESTAMP | Last attempt timestamp                 |
| delivered_at        | TIMESTAMP | Delivery timestamp                     |
| response            | TEXT      | Delivery response                      |
| created_at          | TIMESTAMP | Creation timestamp                     |

## Implementation Considerations

1. **Reliability**: The system must handle blockchain reorgs, connection failures, and retry mechanisms
2. **Performance**: The system must efficiently process a high volume of events with minimal delay
3. **Scalability**: The design should allow horizontal scaling as the number of subscriptions grows
4. **Data Retention**: Implement appropriate data retention policies based on event importance
5. **Security**: Properly validate and sanitize all input, especially subscription parameters

## Integration with Contract Automation

The Event Monitoring System integrates with the Contract Automation service to:

1. Trigger automation workflows based on blockchain events
2. Support complex conditional logic based on event parameters
3. Chain multiple events for complex scenarios
4. Provide event data to automation actions

## Use Cases

1. **Token Transfer Monitoring**: Monitor transfers of specific tokens to/from addresses
2. **Contract State Changes**: Monitor state changes in smart contracts
3. **Market Events**: Monitor DEX trades, price changes, or liquidity events
4. **Governance Events**: Monitor DAO proposals, votes, or execution events
5. **NFT Activities**: Monitor minting, transfers, or sales of NFTs 