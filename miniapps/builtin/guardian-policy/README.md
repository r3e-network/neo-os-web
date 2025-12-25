# Guardian Policy

Multi-sig Security Guardian with TEE-enforced transaction rules.

## Overview

Guardian Policy provides an additional security layer for your Neo N3 wallet. Define custom transaction rules that are enforced by the TEE (Trusted Execution Environment) before any transaction is approved.

## Features

- **Custom Rules**: Define daily limits, whitelist-only transfers, time locks
- **TEE Enforcement**: Rules enforced in secure enclave, tamper-proof
- **Address Whitelist**: Only allow transfers to approved addresses
- **Spending Limits**: Set daily and per-transaction caps
- **Time Delays**: Require waiting period for large transfers

## How It Works

1. **Configure Rules**: Add security rules from templates
2. **Set Limits**: Define daily/transaction spending caps
3. **Manage Whitelist**: Add trusted recipient addresses
4. **Enable Guardian**: Activate TEE-enforced protection

## Rule Templates

| Rule               | Description                                   |
| ------------------ | --------------------------------------------- |
| **Daily Limit**    | Block transfers exceeding daily GAS limit     |
| **Whitelist Only** | Only allow transfers to whitelisted addresses |
| **Time Lock**      | Require delay for transfers above threshold   |

## Technical Details

### Platform Capabilities Used

| Capability   | Usage                  |
| ------------ | ---------------------- |
| **Payments** | Policy fee (0.005 GAS) |
| **Compute**  | TEE rule enforcement   |

### Security Architecture

```
Transaction Request → TEE Validation → Rule Check → Approve/Reject
        ↓                  ↓              ↓            ↓
   User intent      Secure enclave   Policy eval   Sign or block
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "compute": true
  },
  "assets_allowed": ["GAS"],
  "security": {
    "attestation_required": true
  }
}
```

## Use Cases

- **High-Value Wallets**: Protect large GAS holdings
- **Team Treasuries**: Multi-sig with spending policies
- **DeFi Users**: Prevent unauthorized withdrawals

## Development

```bash
# Serve locally
npx serve miniapps/builtin/guardian-policy

# Or run via host app
cd platform/host-app && npm run dev
```

## Related Apps

- [Secret Vote](../secret-vote/) - TEE-based privacy voting
- [Secret Poker](../secret-poker/) - TEE card games
- [Gov Booster](../gov-booster/) - Governance tools
