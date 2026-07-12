# Gas Lucky Pool asset provenance

The playable Phaser scene uses the following repository assets:

| Runtime asset | Purpose |
| --- | --- |
| `public/gas-vault-stage.webp` | Warm mint-and-gold vault, podium, coins, and reveal-stage background |
| `public/onegate-logo.webp` | OneGate mark used for local point tokens |
| `public/banner.webp` / `public/banner.avif` | Catalog and launcher cover |
| `public/logo.webp` / `public/logo.avif` | Catalog and launcher icon |

The vault stage and launcher media are longstanding project-authored resources.
Git history records `gas-vault-stage.webp` in commit `488fa04ec` and the OneGate
launcher media in commits `9a8d1373d`, `c1e62a04b`, and `488fa04ec`.

When the GameFi lane is eventually re-enabled, every visible GAS token mark is
loaded from the shared official token asset through
`officialGasTokenPhaserUrl`; the app does not ship a hand-drawn GAS or NEO logo.

No code or resource was copied from `IcedSoul/minigame-everyday`. The inspected
snapshot (`73bb72f`) contains screw, fruit, arrow, sheep, goose, and bead games,
but no lottery, wheel, vault, or range-pool implementation. Its README says MIT
while the snapshot has no root license file and explicitly says its art is not
copied, so it remains reference-only for this app.
