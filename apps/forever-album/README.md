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
3. **Wallet-signed Storage**: The storage proxy returns a Neo contract intent and `ChainService` submits it through the connected wallet
4. **View Album**: Saved photos load back from the wallet-scoped storage prefix and open in the in-app viewer
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
3. Submit the upload through the platform storage service proxy; the returned contract intent is signed by the wallet.
4. Reopen the app to view the saved gallery, and decrypt encrypted photos locally when needed.

## Storage Model

- Photos are stored as base64 data URL payloads under `photos:<wallet>:<photoId>` through the shared storage proxy.
- Encrypted uploads store ciphertext only; the password never leaves the client.
- Each photo entry includes owner, encryption flag, and timestamp.
- Limits: max 5 photos per upload, 45KB per photo, 60KB total payload.

## Service Interface

- `storage.list("photos:<wallet>:", 50)` — build/read the wallet-scoped gallery query
- `storage.set("photos:<wallet>:<photoId>", photo)` — build the durable photo storage intent
- `chain.invoke(intent.operation, intent.args, { scriptHash: intent.contract })` — submit OS storage writes through the wallet
- `nft.mint({ type: "album-upload", photoIds, count, encrypted })` — optional lightweight marker after the storage write
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
