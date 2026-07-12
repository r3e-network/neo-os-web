# Neo Signature Desk

Neo Signature Desk prepares exact UTF-8 payloads for Neo N3 wallet message signing. It supports plain text and local SHA-256 file digests, shows the exact wallet payload before approval, and exports the accepted wallet response as a portable JSON signature record.

## Runtime contract

- App ID: `miniapp-neo-sign-anything`
- Version: `1.1.0`
- Networks: Neo N3 mainnet and testnet
- Permission: `wallet:sign-message`
- Transactions: none
- App contract: none

## Signing modes

Purpose-bound envelope is the default. The signed v1 envelope binds:

- signing domain;
- Neo N3 network;
- signer address captured for the wallet request;
- content kind, UTF-8 byte count, and SHA-256;
- file name, byte size, media type, and file SHA-256 when a file digest is loaded.

Exact text mode signs the textarea value byte-for-byte as UTF-8. It is intended for third-party challenge strings that must not be wrapped or modified.

In exact text mode, the captured account and network are request context only. They are not included in the signed bytes. The exact payload and its SHA-256 can be reviewed before connecting a wallet; a confirmed Neo N3 account and network are still required to sign.

## File handling

Files up to 64 MB are read and hashed in the browser with Web Crypto. The file is never uploaded. Only `sha256:<lowercase hex digest>` is placed in the editor and signed. The purpose-bound envelope also includes the file metadata shown in the UI.

## Signature-record semantics

The JSON artifact includes the exact signed text, its byte count and SHA-256, the captured account and network, normalized signature encoding, and the wallet-returned public key when available. Its `signer.binding` field distinguishes a `signed-envelope` from `observed-request-context`.

The assurance status is deliberately `wallet-returned`. This miniapp does not claim local cryptographic verification because Neo wallet providers use wallet-specific message-signing transport and verification conventions. A verifier must apply the convention used by the signing wallet.

If the account, network, content, domain, or file context changes while the wallet prompt is open, the returned signature is discarded. When the wallet provider reports the account that actually signed, it must match the prepared account (address or script-hash form) or the response is rejected. Editing any signed input also clears the current record immediately. A failed replacement file selection clears any previous file digest so it cannot be mistaken for the newly selected file.

## Chain and oracle boundaries

- The active network is read from the connected wallet and normalized to `neo-n3-mainnet` or `neo-n3-testnet`; any other value fails closed and clears the displayed network.
- The app calls only the framework wallet connection, network detection, and message-signing services.
- It has no contract, RPC read, oracle request, transaction construction, broadcast, token transfer, or network fee path.
- Signing and file hashing failures keep user-entered text available for correction, while stale or ambiguous signing results are discarded.

## Local history

The app stores up to eight history rows in framework-scoped local storage. History contains only record metadata and hashes, not the raw message, signature, public key, or full JSON record. Malformed local rows are ignored and the UI reports degraded history storage without blocking signing.

## Assets

The production desk illustration and catalog media are repository-local resources with no runtime network fetch. See [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for source and usage details.

## Development

```bash
npm run build
```

No deployment, wallet signing, or on-chain transaction is needed for deterministic local validation.

Production verification and the remaining real-wallet compatibility boundary
are recorded in [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) and
[NETWORK_STATUS.md](./NETWORK_STATUS.md).
