# Timestamp Proof 时间戳证明

Immutable proof of existence on Neo N3 blockchain. Create verifiable, tamper-proof records that a document or data existed at a specific point in time.

## Overview

Timestamp Proof creates cryptographically secure evidence that a document existed at a specific time by storing its SHA-256 hash on the Neo N3 blockchain. Perfect for intellectual property protection, legal documentation, and creative works registration.

## Features

- **Document Hashing**: SHA-256 hash stored permanently on-chain
- **Instant Verification**: Verify document existence and timestamp instantly
- **Legal Evidence**: Court-admissible proof of existence timestamps
- **Privacy Preserving**: Only the hash is stored, not the document content
- **Batch Processing**: Process multiple documents efficiently
- **Certificate Generation**: Downloadable proof certificates with QR codes
- **Offline Verification**: Verify proofs without internet connection

## Usage

### Creating a Timestamp Proof

1. **Prepare Document**: Have your document ready (PDF, image, text, or any file)
2. **Create Proof**: Enter document content or hash in the proof creation form
3. **Confirm Transaction**: Sign the blockchain transaction with your Neo wallet
4. **Save Certificate**: Download and store your proof certificate safely
5. **Record Proof ID**: Note the proof ID for future verification

### Verifying a Timestamp

1. **Enter Proof ID**: Input the proof ID from the certificate
2. **Upload Document**: Provide the original document for hash comparison
3. **Instant Verification**: System confirms if document matches the stored hash
4. **View Details**: See exact timestamp and block information

## How It Works

1. **Document Processing**: Document hash is calculated locally in your browser
2. **Hash Storage**: Only the SHA-256 hash (not the document) is stored on Neo N3
3. **Blockchain Record**: Hash is permanently recorded with block timestamp
4. **Proof Generation**: Certificate contains proof ID, hash, and timestamp
5. **Verification**: Any party can verify by comparing document hash to stored hash

## Use Cases

- **Intellectual Property**: Prove invention or creation date
- **Legal Documents**: Contract signing timestamps and evidence
- **Research Data**: Integrity verification for scientific data
- **Creative Works**: Copyright and ownership proof
- **Audit Trails**: Immutable record of document versions
- **Compliance**: Regulatory requirement for data retention

## Architecture

- **Type**: Frontend-only application
- **Network**: Neo N3 Mainnet/Testnet
- **Hash Algorithm**: SHA-256
- **Storage**: Document hashes stored on Neo N3 blockchain
- **Privacy**: Original documents never leave your device
- **Verification**: Can be verified by anyone with the proof ID

## Technical Details

- **Category**: Utility/Tool
- **Network**: Neo N3 Mainnet
- **Hash Function**: SHA-256
- **SDK**: @neo/uniapp-sdk
- **Permissions**: invoke:primary, read:blockchain

## Development

```bash
cd apps/timestamp-proof
pnpm install
pnpm dev
```

### Project Structure

- `src/pages/index/index.vue` - Main interface (create and verify proofs)
- `src/composables/useI18n.ts` - Internationalization (EN/ZH)
- `src/static/` - Assets and certificates

## Security

- **Client-Side Hashing**: Documents are hashed locally, content never uploaded
- **Immutable Records**: Once recorded, timestamps cannot be altered
- **Cryptographic Proof**: SHA-256 provides collision-resistant hashing
- **Decentralized**: Proof exists on Neo N3 blockchain, not centralized servers

## License

MIT License - R3E Network
