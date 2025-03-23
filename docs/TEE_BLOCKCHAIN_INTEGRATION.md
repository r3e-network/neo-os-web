# TEE-Blockchain Integration

This document outlines the integration between Trusted Execution Environment (TEE) and blockchain services in the Neo N3 Service Layer.

## Overview

The TEE-Blockchain integration allows JavaScript functions running in a secure TEE environment to interact with the Neo N3 blockchain. This integration enables secure, verifiable, and private execution of custom logic that can read from and write to the blockchain.

## Architecture

The integration follows a layered architecture with the following components:

1. **JavaScript Runtime (V8)**: Executes user-defined JavaScript functions in a secure sandbox.
2. **TEE Execution Context**: Provides context for function execution, including access to secrets and blockchain clients.
3. **Blockchain Client Interface**: Abstracts blockchain operations for consistent access.
4. **NEO SDK Compatibility Layer**: Translates between service layer and Neo-Go SDK types.

```
┌─────────────────────────────────────────┐
│           JavaScript Function            │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│            TEE Runtime (V8)             │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│          TEE Execution Context          │
└───┬─────────────────────────────┬───────┘
    │                             │
┌───▼───────────────┐    ┌────────▼────────┐
│   Secret Manager   │    │ Blockchain Client│
└───────────────────┘    └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  NEO SDK Compat  │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │    Neo N3 Node   │
                         └─────────────────┘
```

## JavaScript API

Users can access blockchain functionality through a global `neo` object provided in the JavaScript runtime:

```javascript
// Example JavaScript function with blockchain interaction
async function run(args) {
  // Get blockchain information
  const blockHeight = await neo.getBlockCount();
  
  // Call a smart contract
  const result = await neo.invokeFunction("0x1234567890abcdef1234567890abcdef12345678", "balanceOf", [
    neo.utils.addressToScriptHash(args.address)
  ]);
  
  // Send a transaction (if private key is available)
  if (secrets.privateKey) {
    const tx = await neo.createTransaction({
      scriptHash: "0x1234567890abcdef1234567890abcdef12345678",
      operation: "transfer",
      params: [
        neo.utils.addressToScriptHash("NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj"),
        neo.utils.addressToScriptHash(args.targetAddress),
        args.amount
      ],
      signers: [
        {
          account: neo.utils.getSigningAccount(secrets.privateKey),
          scopes: "CalledByEntry"
        }
      ]
    });
    
    const signedTx = await neo.signTransaction(tx, secrets.privateKey);
    const txid = await neo.sendTransaction(signedTx);
    
    return { txid: txid };
  }
  
  return {
    blockHeight: blockHeight,
    balance: result.stack[0].value
  };
}
```

## Available Methods

### Core Blockchain Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `neo.getBlockCount()` | Gets the current blockchain height | None | `Promise<number>` |
| `neo.invokeFunction(scriptHash, operation, params)` | Calls a read-only smart contract method | `scriptHash: string`, `operation: string`, `params: any[]` | `Promise<InvocationResult>` |
| `neo.createTransaction(params)` | Creates a transaction | `TransactionParams` object | `Promise<string>` |
| `neo.signTransaction(tx, privateKey)` | Signs a transaction | `tx: string`, `privateKey: string` | `Promise<string>` |
| `neo.sendTransaction(signedTx)` | Sends a signed transaction | `signedTx: string` | `Promise<string>` |
| `neo.getTransaction(txid)` | Gets transaction details | `txid: string` | `Promise<Transaction>` |
| `neo.getStorage(scriptHash, key)` | Gets contract storage data | `scriptHash: string`, `key: string` | `Promise<string>` |
| `neo.getBalance(address, assetID)` | Gets token balance | `address: string`, `assetID: string` | `Promise<string>` |

### Utility Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `neo.utils.addressToScriptHash(address)` | Converts address to script hash | `address: string` | `string` |
| `neo.utils.scriptHashToAddress(scriptHash)` | Converts script hash to address | `scriptHash: string` | `string` |
| `neo.utils.getSigningAccount(privateKey)` | Gets account script hash from private key | `privateKey: string` | `string` |
| `neo.utils.stringToHex(str)` | Converts string to hex | `str: string` | `string` |
| `neo.utils.hexToString(hex)` | Converts hex to string | `hex: string` | `string` |

## Security Considerations

The TEE-Blockchain integration includes several security measures:

1. **Memory Isolation**: Each function execution has its own isolated memory space.
2. **Resource Limits**: Functions have strict memory and execution time limits.
3. **Network Control**: Functions can only access the blockchain through the provided API.
4. **Secret Protection**: Cryptographic keys and secrets are protected by the TEE.
5. **Input Validation**: All blockchain parameters are validated before use.

## Error Handling

Blockchain operations may fail for various reasons. Functions should use try-catch blocks for proper error handling:

```javascript
async function run(args) {
  try {
    const blockHeight = await neo.getBlockCount();
    return { blockHeight: blockHeight };
  } catch (error) {
    return { error: error.message };
  }
}
```

## Testing

TEE-Blockchain integration is tested on several levels:

1. **Unit Tests**: Test individual components with mock implementations.
2. **Integration Tests**: Test the complete integration flow with mock blockchain.
3. **Security Tests**: Verify memory limits, timeout handling, and resource controls.
4. **End-to-End Tests**: Test with a real Neo N3 testnet node.

## Limitations

1. **Transaction Finality**: The blockchain may take time to finalize transactions.
2. **Gas Costs**: Writing to the blockchain requires GAS tokens.
3. **Block Time**: Blockchain operations are subject to block time constraints.
4. **Network Failures**: The blockchain network may be temporarily unavailable.

## Future Enhancements

1. **Event Subscriptions**: Allow functions to subscribe to blockchain events.
2. **Multiple Blockchain Support**: Expand beyond Neo N3 to other blockchains.
3. **Advanced Analytics**: Provide insights and metrics on blockchain operations.
4. **Batched Operations**: Allow batching multiple blockchain operations for efficiency. 