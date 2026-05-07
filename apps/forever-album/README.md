# Forever Album

Create a wallet-scoped photo vault through platform storage and NFT service proxies, with optional AES-GCM encryption.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-forever-album` |
| **Category** | social |
| **Version** | 1.1.0 |
| **Framework** | Host-native React playarea |


## How It Works

1. **Upload Photos**: Select and encrypt photos before uploading
2. **Encryption**: Photos are encrypted client-side using AES-256
3. **Platform Storage**: Metadata and encryption references are written through the shared storage/NFT service proxies
4. **Share Album**: Create shared albums with specific viewers
5. **Durable Access**: Photos remain accessible through the platform storage service and wallet-scoped indexes
## Features

- Per-wallet album indexing (each address owns its own album)
- Upload up to 5 photos per transaction (total payload < 60KB)
- Optional AES-GCM client-side encryption
- Wallet-scoped uploads with platform storage timestamps

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| Automation | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | No dedicated contract; storage is routed through platform service proxies |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | N/A |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | No dedicated contract; storage is routed through platform service proxies |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | N/A |
| **Network Magic** | `860833102` |

## Usage Flow

1. Select up to five photos and ensure the total payload stays under 60KB.
2. Optionally enable AES-GCM encryption and set a password.
3. Submit the upload through the platform storage/NFT service proxy.
4. Decrypt encrypted photos locally when viewing.

## Storage Model

- Photos are stored as base64 data URL payloads per wallet address through the shared storage proxy.
- Encrypted uploads store ciphertext only; the password never leaves the client.
- Each photo entry includes owner, encryption flag, and timestamp.
- Limits: max 5 photos per upload, 45KB per photo, 60KB total payload.

## Service Interface

- `storage.list("photos:", 50)` — list wallet-scoped photo records
- `storage.get("photo:<id>")` — read one stored photo record
- `nft.mint({ type: "photo", data, encrypted })` — create the durable storage record
- `badge.award("album-creator")` — award the creator badge after a successful upload

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

## Assets

- **Allowed Assets**: None (photos are stored as data payloads)

## License

MIT License - R3E Network
