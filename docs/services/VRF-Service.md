# VRF Service

> Verifiable Random Function for provably fair randomness

## Overview

The VRF Service generates cryptographically secure random numbers with on-chain verification, ensuring fairness for games, lotteries, and NFT minting.

| Feature           | Description                    |
| ----------------- | ------------------------------ |
| **Verifiable**    | On-chain proof verification    |
| **Unpredictable** | Cannot be predicted in advance |
| **Deterministic** | Same seed = same output        |
| **TEE-generated** | Secure enclave computation     |

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MiniApp       │────▶│   TEE Enclave   │────▶│   Smart Contract│
│   Request       │     │   VRF Generate  │     │   Verify Proof  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. App requests random number with seed
2. TEE generates VRF output and proof
3. Proof submitted on-chain for verification
4. Result returned to app

## SDK Usage

```javascript
import { useRNG } from "@neo/sdk";

const { requestRandom } = useRNG();

// Request random number
const result = await requestRandom({
    min: 1,
    max: 100,
    seed: "optional-seed",
});

console.log(result.value); // Random number
console.log(result.proof); // Verification proof
```

## Verification

Anyone can verify the randomness:

```javascript
const isValid = await verifyProof(result.proof, result.value);
```

## Use Cases

- Lottery draws
- NFT trait generation
- Game mechanics
- Fair selection

## Next Steps

- [Oracle Service](./Oracle-Service.md)
- [Security Model](../architecture/Security-Model.md)

## Integration Example

```typescript
import { useRNG } from "@neo/uniapp-sdk";

const { requestRandom, verifyProof } = useRNG();

// Generate random for lottery
const result = await requestRandom({
    min: 1,
    max: 1000,
    seed: `lottery-${Date.now()}`,
});

// Verify on-chain
const isValid = await verifyProof(result.proof);
```

## Best Practices

| Practice      | Description        |
| ------------- | ------------------ |
| Unique seeds  | Prevent prediction |
| Verify proofs | Ensure fairness    |
| Store results | For audit trail    |
