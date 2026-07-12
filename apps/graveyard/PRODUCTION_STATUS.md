# Graveyard production status

Status date: 2026-07-11

## Product result

- The app is a warm Memory Garden ritual, not a generic contract form. The
  garden and letter artwork carry the primary experience; live fees, wallet
  route and irreversible effects are contained in the review surface.
- Private notes and local files are SHA-256 hashed on-device. Only the digest,
  selected type and signed contract arguments can reach Neo N3.
- Burial and forgetting use explicit review, current contract fees, exact event
  matching and wallet-scoped recovery without duplicate GAS deposits.
- Epitaph writes persist the exact wallet, memory ID, text and transaction ID at
  broadcast. Success requires both the matching `EpitaphAdded` event and exact
  `getMemoryDetails` readback.
- An unresolved epitaph becomes a compact, read-only recovery card. New epitaph
  signatures remain disabled until “Check status” confirms canonical state.
- Recovery storage is probed before every wallet write. A storage failure blocks
  writing without hiding the read-only memory records.
- The public operation panel is empty; all operations stay inside the designed
  application workspace.

## Network boundary

- App ID: `miniapp-graveyard`
- Supported network: Neo N3 TestNet
- Contract: `0xb55aa635b10a5abb5cbac169db26a38df739778e`
- No MainNet deployment is claimed.
- No funded transaction, wallet signature, contract deployment or secret was
  used for this verification lane.

## Verification evidence

- Focused logic, PlayArea and integration suite: `49/49` tests passed from both
  the repository root and `apps/shared` working directories.
- TypeScript, scoped ESLint and whitespace checks passed.
- Production build: 1,848 modules transformed; app entry 219.77 kB
  (66.87 kB gzip), with React, UI, platform SDK and crypto split into vendor
  chunks.
- The active garden and letter image assets were inspected directly and retain
  the bright, warm, high-contrast product direction.
- Static HTTP verification: all `17/17` emitted files returned HTTP 200.
- Verified `dist/` was copied to the host miniapp directory and is byte-identical.
- Host catalog: 77 entries, 77 unique app IDs, one `miniapp-graveyard` at version `1.1.0`.
- Browser screenshot comparison is not claimed in this lane because no browser
  automation was used.
