# Bridge Guardian

Cross-Chain Asset Bridge with TEE-secured SPV verification.

## Overview

Bridge Guardian enables trustless asset bridging between Neo N3 and other chains (Ethereum, Bitcoin). TEE validates SPV proofs before releasing bridged assets.

## Features

- **Multi-Chain Support**: Ethereum and Bitcoin bridges
- **SPV Verification**: Light client proof validation
- **TEE Security**: Signing keys protected in enclave
- **Confirmation Tracking**: Real-time confirmation status
- **Transaction History**: Track all bridge operations

## How It Works

1. **Select Chain**: Choose destination chain
2. **Enter Amount**: Specify GAS to bridge
3. **Provide Address**: Enter destination address
4. **Initiate Bridge**: Pay and start bridging
5. **Wait Confirmations**: 12 confirmations required

## Technical Details

### Platform Capabilities

| Capability     | Usage                   |
| -------------- | ----------------------- |
| **Payments**   | Bridge fees             |
| **Datafeed**   | Block header sync       |
| **Automation** | Confirmation monitoring |
| **Compute**    | TEE SPV verification    |

## Development

```bash
npx serve miniapps/builtin/bridge-guardian
```
