# Random Number Generation Service

## Overview

The Random Number Generation Service provides verifiable random numbers for Neo N3 smart contracts. It uses cryptographic techniques to generate secure random numbers that can be verified on-chain, ensuring fairness and transparency for applications such as gaming, lotteries, and randomized selection processes.

## Features

- Generation of cryptographically secure random numbers
- On-chain verification mechanism for proving randomness
- Commit-reveal scheme for transparent random number generation
- Support for different entropy sources
- Historical record of generated random numbers
- TEE-based entropy generation for enhanced security
- Configurable seed parameters

## Architecture

The Random Number Generation Service consists of the following components:

1. **Request Handler**: Accepts and validates random number requests
2. **Entropy Collector**: Gathers entropy from multiple sources
3. **Generator**: Produces random numbers using collected entropy
4. **Commitment Manager**: Handles commit-reveal scheme
5. **Verification System**: Provides proofs for on-chain verification
6. **Storage Layer**: Records generated numbers and verification data

## Generation Process

The service follows a commit-reveal scheme to ensure transparency and fairness:

1. **Commit Phase**:
   - Service generates a commitment to a future random value
   - Commitment hash is stored and provided to the requester
   - Commitment is published on-chain (optional)

2. **Reveal Phase**:
   - After a specified time or event, the random number is generated
   - The original commitment is revealed along with the random number
   - Verification proof is generated for on-chain validation

3. **Verification**:
   - Smart contracts can verify the random number on-chain
   - Verification proves the number was not manipulated after commitment

## Entropy Sources

The service uses multiple entropy sources to ensure high-quality randomness:

- TEE-based hardware random number generator
- System entropy pool
- External randomness beacons (optional)
- Time-based factors
- Transaction-based information from the Neo N3 blockchain

## Cryptographic Techniques

The service employs several cryptographic techniques:

- SHA-256 for commitment hashing
- HMAC for combining entropy sources
- Verifiable Random Functions (VRFs) for provable randomness
- Secure multi-party computation for distributed random generation (advanced mode)

## Smart Contract Integration

### Example Random Number Consumer Contract (Pseudo-code)

```go
// Random number consumer contract interface
type RandomConsumer interface {
    // Request a random number 
    RequestRandomNumber(requestID uint64, seed []byte) bool
    
    // Callback for receiving the random number
    ReceiveRandomNumber(requestID uint64, randomNumber []byte, proof []byte) bool
    
    // Verify a random number on-chain
    VerifyRandomNumber(randomNumber []byte, proof []byte) bool
}
```

### On-chain Verification

The service provides two verification methods:

1. **Callback-based**: Service sends the random number to a contract callback
2. **On-demand verification**: Contracts directly verify random numbers

## API Endpoints

### Admin API

- `GET /api/v1/random/requests` - List all random number requests
- `GET /api/v1/random/requests/{id}` - Get details of a specific request
- `POST /api/v1/random/requests` - Create a new random number request
- `GET /api/v1/random/analysis` - Get statistical analysis of generated numbers

### Public API

- `POST /api/v1/public/random` - Request a new random number
- `GET /api/v1/public/random/{id}` - Get a generated random number
- `GET /api/v1/public/random/{id}/verify` - Verify a random number

## Request Parameters

Random number requests support the following parameters:

- `callback_address`: Neo N3 contract address to receive the random number
- `callback_method`: Method to call with the random number
- `seed`: Additional entropy provided by the requester
- `block_height`: Neo N3 block height to use as an entropy source
- `num_bytes`: Number of random bytes to generate (default: 32)
- `delay_blocks`: Number of blocks to wait before revealing (default: 0)
- `gas_fee`: GAS fee to pay for the callback transaction

## Security Considerations

- All random generation occurs within the TEE environment
- Multiple entropy sources prevent predictability
- Commit-reveal scheme prevents manipulation
- On-chain verification enables trustless operation
- Rate limiting prevents DoS attacks
- Audit logs track all random number generation

## Performance Considerations

- Batched on-chain operations for efficiency
- Caching of frequently used parameters
- Optimized verification proofs
- Pre-generated entropy pools (secure implementation)
- Prioritization of urgent random number requests

## Use Cases

- Gaming and gambling applications
- Fair distribution mechanisms
- Lottery systems
- Randomized selection processes
- NFT trait generation
- Random assignment algorithms

## Monitoring and Metrics

The service provides the following metrics:

- Request volume and success rate
- Entropy quality measurements
- Generation time statistics
- Verification success rates
- Gas usage for on-chain operations

These metrics are exposed via Prometheus and can be visualized in Grafana dashboards. 