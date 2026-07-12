# Forever Album

Forever Album is a small, device-local photo album separated by connected Neo wallet address. The wallet is used only as a local album identity: saving, opening, decrypting, and deleting photos never creates a transaction or GAS charge.

## Product model

- Photos stay in this browser's `localStorage` on this device.
- A connected wallet address selects a separate local album partition.
- Optional password protection stores AES-256-GCM ciphertext; the password is neither persisted nor transmitted.
- There is no contract, chain read, platform-storage write, cloud sync, or recovery service.
- Clearing site data deletes the local album. Users must keep original photos backed up elsewhere.

## User flow

1. Choose up to five JPEG, PNG, WebP, AVIF, or GIF images.
2. Review the real image previews and local capacity meter.
3. Optionally enable encryption and confirm the password.
4. Connect a wallet if needed to select the local album partition.
5. Save to the device. Success is shown only after a read-back verification.
6. Open an image, unlock encrypted memories locally, or delete items to free space.

## Capacity and recovery

- Source data URL: up to 768 KiB per photo.
- Supported imports are verified from JPEG, PNG, WebP, AVIF, or GIF file signatures instead of trusting only a filename or MIME label.
- Import batch: up to five photos and 2 MiB after optional encryption.
- Wallet album: 3 MiB of stored photo payloads on this device.
- Failed or quota-limited writes keep the selected batch for retry.
- Wallet changes immediately clear the previous gallery and sensitive draft state. Cancelling an unlock or changing wallets also invalidates in-flight decryption, so a late result cannot reopen a photo from an old partition.
- Damaged local data is surfaced explicitly; readable entries are recovered, and a wallet-scoped reset is available for an unreadable album.

## Storage format

The framework namespace remains `forever-album:` for migration compatibility. Each wallet album is stored at `forever-album:photos:<address>` as a versioned envelope. The reader also accepts the earlier bare-array local format.

## Development

```bash
npm run dev
npm run build
```

The app uses the shared React miniapp framework and the production artwork in `public/forever-album-memory-stage.webp`.

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for verified behavior and boundaries, [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the explicit no-chain model, and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for the artwork custody audit.

## License

MIT License - R3E Network
