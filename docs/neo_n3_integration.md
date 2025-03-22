# Neo N3 Blockchain Integration

This document outlines how the Service Layer integrates specifically with the Neo N3 blockchain.

## Overview

The Neo N3 Service Layer is designed to work exclusively with the Neo N3 blockchain, providing oracle services, automation, and JavaScript function execution within a TEE. Unlike Chainlink, which supports multiple blockchains, our service is focused entirely on Neo N3, allowing for deeper and more specialized integration.

## Neo N3-Specific Components

### Neo N3 Blockchain Interface

The blockchain interface is tailored specifically for Neo N3, using the Neo Go SDK to interact with Neo N3 nodes. It handles:

- Transaction signing and submission
- Smart contract invocation
- Event monitoring
- Block data retrieval

The interface is implemented in the `internal/blockchain` package and provides a consistent API for interacting with Neo N3.

### Contract Automation for Neo N3

The Contract Automation service specifically supports Neo N3 smart contracts. It can:

1. **Monitor Neo N3 blockchain events** - Subscribe to events emitted by Neo N3 smart contracts and trigger function execution when events are detected.
2. **Invoke Neo N3 smart contract methods** - Execute functions that can call methods on Neo N3 smart contracts.
3. **Deploy Neo N3 smart contracts** - Functions can be used to deploy new contracts to the Neo N3 blockchain.

Triggers can be configured based on:
- Neo N3 blockchain events (e.g., Transfer events from a specific contract)
- Neo N3 block production (based on block number or time)
- Oracle data changes related to Neo N3 (e.g., NEO or GAS price changes)

### Neo N3 Smart Contract Templates

The Service Layer provides templates for Neo N3 smart contracts that are designed to work with the service, including:

1. **Oracle Consumer Contract** - For receiving price feed data and random numbers.
2. **Automated Contract** - For contracts that need to be triggered by external events.
3. **Gas Bank Contract** - For managing gas used by the Service Layer.

These templates are implemented in C# for the Neo N3 blockchain.

## Neo N3 SDK

The Service Layer uses the Neo Go SDK to interact with the Neo N3 blockchain. Key components include:

- **RPC Client** - For sending requests to Neo N3 nodes.
- **Wallet Management** - For securely managing Neo N3 wallets.
- **Smart Contract Interaction** - For invoking smart contract methods.
- **Event Monitoring** - For subscribing to Neo N3 blockchain events.

## Neo N3 Smart Contract Interaction

### Invoking Neo N3 Smart Contracts

Functions within the Service Layer can invoke methods on Neo N3 smart contracts using the blockchain interface:

```go
func InvokeNeoContract(contractHash, method string, params []interface{}) (interface{}, error) {
    // Convert parameters to Neo N3 stack items
    stackItems := ConvertToStackItems(params)
    
    // Invoke contract method
    return blockchainClient.InvokeFunction(contractHash, method, stackItems)
}
```

### Monitoring Neo N3 Events

The Service Layer can subscribe to events emitted by Neo N3 smart contracts:

```go
func SubscribeToNeoEvents(contractHash, eventName string, handler func(event interface{})) error {
    return blockchainClient.SubscribeToEvents(contractHash, eventName, handler)
}
```

This enables trigger-based automation when specific events occur on the Neo N3 blockchain.

## Price Feed for Neo N3 Assets

The Price Feed service specifically supports Neo N3 assets like NEO, GAS, and NEP-5/NEP-17 tokens. It:

1. Aggregates price data from multiple sources for Neo N3 assets.
2. Provides on-chain price updates through oracle contracts on Neo N3.
3. Supports threshold-based triggers when Neo N3 asset prices change significantly.

## Gas Bank for Neo N3

The Gas Bank service is specialized for Neo N3's gas system, allowing:

1. Users to deposit GAS that the Service Layer can use to execute transactions on their behalf.
2. Optimizing gas usage for Neo N3 transactions by batching operations when possible.
3. Providing gas usage reports specific to Neo N3 operations.

## Neo N3-Specific Models

The system includes models specific to Neo N3 blockchain data:

- **Neo N3 Contract** - Model representing a Neo N3 smart contract.
- **Neo N3 Transaction** - Model representing a Neo N3 transaction.
- **Neo N3 Event** - Model representing a Neo N3 blockchain event.
- **Neo N3 Block** - Model representing a Neo N3 blockchain block.

## Neo N3 Contract Registration

Contracts deployed on Neo N3 can be registered with the Service Layer to enable integration:

```http
POST /v1/contracts
Content-Type: application/json
Authorization: Bearer {your_token}

{
  "name": "My Oracle Consumer",
  "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
  "description": "Contract that consumes oracle data",
  "contract_type": "oracle_consumer"
}
```

This registers the contract and allows the Service Layer to:
1. Monitor events from the contract
2. Call methods on the contract
3. Set up triggers related to the contract

## Smart Contract Examples

### Oracle Consumer Contract

The `OracleConsumer.cs` contract in the `contracts` directory is specifically designed for the Neo N3 blockchain using Neo N3's native oracle system. It demonstrates:

1. Receiving price data from the Service Layer
2. Getting random numbers
3. Implementing automation callbacks

### Future Considerations

As Neo N3 evolves, the Service Layer will adapt to support new features:

1. **Neo N3 Governance** - Supporting voting and governance mechanisms.
2. **Neo FS Integration** - Supporting storage on Neo FS for off-chain data.
3. **Neo Name Service** - Integrating with Neo Name Service for human-readable contract addresses.