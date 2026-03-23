# Neo Convert Neo 转换工具

Convert Neo addresses, private keys, and script hashes

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-convert` |
| **Category** | utilities |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Offline key toolkit for Neo N3

Generate Neo N3 accounts locally, convert between WIF/private/public keys, derive addresses, and disassemble scripts. Everything runs on-device with no server calls, making it suitable for cold storage preparation and quick format checks.

## Features

- **🔐 Local Key Generation**: Generate Neo N3 accounts entirely on your device with no network transmission
- **🔄 Format Conversion**: Convert between WIF, private keys, public keys, and addresses seamlessly
- **🧾 Script Disassembler**: Turn NeoVM script hex into readable opcode lists for debugging
- **📄 Paper Wallet Export**: Generate QR-backed PDF export for secure offline storage
- **🔍 Format Auto-Detection**: Automatically detects input formats for quick conversion
- **📴 Offline Operation**: No internet connection required - works completely offline
- **🔒 Security First**: Private keys never leave your device

## Usage

### Generate Tab - Creating New Accounts

1. **Open the Generate Tab**: Click on the "Generate" tab in the navigation
2. **Create Account**: The app will generate a new Neo N3 account with:
   - Private Key (hex)
   - WIF (Wallet Import Format)
   - Public Key
   - Neo Address
3. **Export Paper Wallet**: Click the export button to generate a PDF with:
   - QR codes for easy scanning
   - All key formats printed clearly
   - Professional layout for physical storage
4. **Secure Your Keys**: Store the paper wallet in a safe, offline location

### Convert Tab - Format Conversion

1. **Open the Convert Tab**: Switch to the "Convert" tab
2. **Input Your Data**: Paste any of the following formats:
   - **WIF**: Starts with `K` or `L` (e.g., `Kx...`)
   - **Private Key**: 64-character hex string
   - **Public Key**: 66-character hex string (compressed)
   - **Script Hash**: 40-character hex with or without `0x` prefix
   - **Address**: Neo address starting with `N`
3. **View Results**: The app automatically detects the format and displays:
   - All derived formats (address, public key, private key, WIF)
   - Script hash equivalents
   - Verification checksums
4. **Copy Results**: Click any field to copy the converted value to clipboard

### Common Use Cases

**Verifying a Private Key:**
1. Paste the WIF or private key hex
2. Verify the derived address matches your records
3. Confirm before using for transactions

**Script Analysis:**
1. Paste a script hex from a transaction
2. View the disassembled opcodes
3. Understand contract execution flow

**Cold Storage Preparation:**
1. Generate keys offline on an air-gapped device
2. Export paper wallet PDF
3. Print and store securely
4. Never expose private keys to internet-connected devices

### Security Best Practices

⚠️ **Important Security Warnings:**

- **Never share private keys**: Keep all private information confidential
- **Use offline for cold storage**: Generate keys on air-gapped devices when possible
- **Secure your paper wallets**: Store printed wallets in fireproof/waterproof locations
- **Verify before use**: Always double-check addresses before sending funds
- **Clear clipboard**: After copying sensitive data, clear your clipboard

## How It Works

### Cryptographic Operations

Neo Convert performs all cryptographic operations locally using:

**Key Generation:**
1. Generate cryptographically secure random bytes
2. Apply Neo N3 key derivation (secp256r1 curve)
3. Calculate public key from private key
4. Derive Neo address using script hash

**Format Conversions:**
- **WIF**: Base58Check encoding with version byte and checksum
- **Private Key**: Raw 32-byte hex representation
- **Public Key**: Compressed SEC format (33 bytes)
- **Address**: Base58Check of script hash with Neo version byte

**Script Disassembly:**
- Parse hex string into byte array
- Map each byte to corresponding NeoVM opcode
- Display human-readable instruction list

### Architecture

```
┌─────────────────────────────────────────────┐
│           Neo Convert MiniApp               │
├─────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────────┐  │
│  │  Generate   │      │     Convert     │  │
│  │    Tab      │      │      Tab        │  │
│  └──────┬──────┘      └────────┬────────┘  │
│         │                      │           │
│         ▼                      ▼           │
│  ┌─────────────────────────────────────┐   │
│  │      Cryptographic Engine           │   │
│  │  - @r3e/neo-js-sdk/core             │   │
│  │  - @noble/curves (secp256r1)        │   │
│  │  - Custom conversion utilities      │   │
│  └─────────────────────────────────────┘   │
│         │                      │           │
│         ▼                      ▼           │
│  ┌─────────────┐      ┌─────────────────┐  │
│  │ PDF Export  │      │ Format Display  │  │
│  │ (jspdf)     │      │ & Copy          │  │
│  └─────────────┘      └─────────────────┘  │
└─────────────────────────────────────────────┘
```

### Privacy & Security

- **Zero network calls**: No data sent to any server
- **Memory-only processing**: Keys not persisted (except user-initiated exports)
- **Client-side PDF**: Paper wallet generated entirely in browser
- **No analytics**: No tracking or telemetry

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ❌ No |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- No miniapp contract is deployed.
- All key generation, conversion, disassembly, and PDF export run locally in the browser.
- The app does not depend on legacy receipt relays, Oracle, AA, or any platform callback contract.

## Network Configuration

No on-chain contract is deployed.

## Assets

- **Allowed Assets**: None

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

### Dependencies

Key cryptographic libraries:
- `@r3e/neo-js-sdk`: Neo N3 SDK with browser/core compatibility exports
- `@noble/curves`: Pure JavaScript elliptic curve operations
- `jspdf`: PDF generation for paper wallets
- `qrcode`: QR code generation

### Project Structure

```
apps/neo-convert/
├── src/
│   ├── pages/
│   │   └── index/
│   │       ├── index.vue              # Main component
│   │       ├── components/
│   │       │   ├── AccountGenerator.vue
│   │       │   └── ConverterTool.vue
│   │       └── neo-convert-theme.scss
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

## Troubleshooting

**Invalid format errors:**
- Check for extra spaces or newline characters
- Ensure WIF starts with K or L
- Verify hex strings are correct length

**PDF export not working:**
- Check browser permissions for downloads
- Ensure sufficient device storage
- Try using desktop browser for best results

**Conversion results don't match:**
- Different private keys can produce same address (collision is theoretical)
- Double-check input format is detected correctly
- Try manual format selection if auto-detect fails

## Support

For cryptographic questions or security concerns, consult the Neo N3 documentation.
