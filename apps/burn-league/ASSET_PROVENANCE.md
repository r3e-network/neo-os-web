# Burn League asset provenance

The Phaser arena uses repository-owned runtime artwork:

| Asset | Runtime purpose |
| --- | --- |
| `public/burn-league-arena.webp` | Warm gold-and-mint competition arena and ceremonial GAS brazier backdrop |
| `public/logo.webp` / `logo.avif` | Interactive league cauldron/trophy object and launcher icon |
| `public/banner.webp` / `banner.avif` | Launcher/catalog arena cover |
| Shared official GAS token asset | Fuel capsules, orbit, HUD token mark, and burn burst |

The visible game object and background are image resources. Phaser draws only
HUD framing, hit areas, gauges, and transient effects; it does not substitute a
hand-drawn GAS logo for the canonical shared token asset.

No code or art was copied from `IcedSoul/minigame-everyday`. The current upstream
HEAD inspected on 2026-07-11 is `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`
and contains screw, fruit, arrow, sheep, goose, and bead games, but no burn,
league, auction, or staking contest. Its README says MIT, while the repository
has no root `LICENSE` file and says its art is independently generated or open
source; it therefore remains mechanism reference-only for this app.
