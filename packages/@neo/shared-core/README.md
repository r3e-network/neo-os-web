# @neo/shared-core

Cross-platform shared utilities for the Neo MiniApp ecosystem.

## Features

- **Platform-specific exports** - Automatically resolves to web or native implementation
- **Crypto utilities** - SHA256, RIPEMD160, Hash160, Hash256
- **Common utilities** - Address formatting, amount formatting, retry logic
- **Shared types** - WalletState, TransactionResult, ContractInvocation, etc.

## Installation

```bash
pnpm add @neo/shared-core
```

## Usage

### Basic Usage

```typescript
import { formatAddress, formatAmount, WalletState } from "@neo/shared-core";

// Format address for display
const shortAddr = formatAddress("NXV7ZhHaLQ...", 6); // "NXV7Zh...LQ..."

// Format amount
const formatted = formatAmount(1234567.89, 2); // "1,234,567.89"
```

### Platform-Specific Crypto

```typescript
import { randomBytes, hash160 } from "@neo/shared-core/crypto";

// Automatically uses Web Crypto API or expo-crypto
const bytes = randomBytes(32);
const hash = hash160(bytes);
```

## Platform Resolution

The package uses `exports` field with platform conditions:

```json
{
  "exports": {
    ".": {
      "import": {
        "react-native": "./src/index.native.ts",
        "default": "./src/index.web.ts"
      }
    }
  }
}
```

- **Web** (Next.js, uni-app H5): Uses `index.web.ts`
- **React Native** (Expo): Uses `index.native.ts`

## Exports

| Path | Description |
|------|-------------|
| `@neo/shared-core` | Main entry (platform-specific) |
| `@neo/shared-core/utils` | Utility functions |
| `@neo/shared-core/types` | TypeScript types |
| `@neo/shared-core/crypto` | Crypto utilities (platform-specific) |
