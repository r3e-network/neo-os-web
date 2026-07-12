# GasBox asset provenance

## Runtime artwork

| Asset | Runtime use | Provenance |
| --- | --- | --- |
| `src/gasbox-capsule-machine-cutout.webp` | Main interactive capsule-machine object | Existing project-owned GasBox artwork, present in repository history before this production-polish lane |
| `src/gasbox-prize-capsule-cutout.webp` | Prize reel, chute, recovery and market object | Existing project-owned GasBox artwork, present in repository history before this production-polish lane |
| Shared `CoinArt` GAS/NEO icons | Wallet and pool asset identity | Official Neo Press Kit NEO/GAS icons, provided by `apps/shared/art/CoinArt.tsx` |

The frontend does not copy external game art, generate CSS illustrations, use emoji as product artwork, or import assets from the `minigame-everyday` reference repository.

Repository evidence: both runtime cutouts are present by commit `488fa04ec` (2026-07-06). SHA-256 fingerprints at this lane's handoff:

- Machine cutout: `53a63d32edfba7418935627530a42d02e7dbfea3b830ddfd2ce0b9001da7e787`
- Prize capsule cutout: `66676f54cf298d3bd29d85d3ae5fb24ad07099163d2b618469d112504af8418c`

## Packaged storefront artwork

`public/banner.*`, `public/logo.*`, `public/gasbox-capsule-machine.webp`, `public/gasbox-prize-capsule.webp` and `public/gasbox-scene-art.webp` are existing GasBox package assets. This lane did not replace or externally source them.
