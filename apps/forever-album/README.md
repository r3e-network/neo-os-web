# Forever Album

Store photo memories on Neo per wallet address, with optional AES-GCM encryption.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-forever-album` |
| **Category** | social |
| **Version** | 1.1.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Upload Photos**: Select and encrypt photos before uploading
2. **Encryption**: Photos are encrypted client-side using AES-256
3. **On-Chain Storage**: Metadata and encryption references are stored on Neo
4. **Share Album**: Create shared albums with specific viewers
5. **Permanent Access**: Photos remain accessible as long as the contract exists
## Features

- Per-wallet album indexing (each address owns its own album)
- Upload up to 5 photos per transaction (total payload < 60KB)
- Optional AES-GCM client-side encryption
- Wallet-signed uploads with on-chain timestamps

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
| **Contract** | `0x74dc4a954e6bccfd66500b8124e4c404154b9fb9` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x74dc4a954e6bccfd66500b8124e4c404154b9fb9) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x254421a4aeb4e731f89182776b7bc6042c40c797` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x254421a4aeb4e731f89182776b7bc6042c40c797) |
| **Network Magic** | `860833102` |

## Usage Flow

1. Select up to five photos and ensure the total payload stays under 60KB.
2. Optionally enable AES-GCM encryption and set a password.
3. Sign the upload transaction with your wallet.
4. Decrypt encrypted photos locally when viewing.

## Storage Model

- Photos are stored as base64 data URL payloads per wallet address.
- Encrypted uploads store ciphertext only; the password never leaves the client.
- Each photo entry includes owner, encryption flag, and timestamp.
- Limits: max 5 photos per upload, 45KB per photo, 60KB total payload.

## Contract Interface (TestNet)

- `uploadPhotos(string[] photoData, bool[] encryptedFlags)` — upload up to 5 photos per transaction
- `getUserPhotoCount(UInt160 user)` — total photos for a wallet
- `getUserPhotoIds(UInt160 user, int start, int limit)` — paged IDs for a wallet
- `getPhoto(ByteString photoId)` — returns `PhotoId, Owner, Encrypted, Data, CreatedAt`

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
