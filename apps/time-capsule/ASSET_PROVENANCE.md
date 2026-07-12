# Time Capsule asset provenance

No asset from `IcedSoul/minigame-everyday` or another external game repository is used by Time Capsule.

| Runtime asset | Role | Repository provenance | SHA-256 |
| --- | --- | --- | --- |
| `public/time-capsule-stage.webp` | Primary chamber and catalog cover | Existing project asset, first present in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | `f59ef96eef935bf65e17d36852d3a66d57650bac2aac70814dd6b90be648d2f4` |
| `public/logo.webp` / `public/logo.avif` | Catalog icon raster variants | Derived from the repository logo master first present in commit `c1e62a04b7481b60b4d20c0140dd1f93d27c797a` | `e4e97761e0088280792086a45360d4b4a7a3e23a042694400aa2939801ff4feb` / `de5ba05d177aa878da2e1d40502531c9c6f85dc24a4a08582faa287b1b1fa14d` |
| `public/banner.webp` / `public/banner.avif` | Retained legacy promotional variants; not the current catalog cover | Derived from the repository banner master first present in commit `c1e62a04b7481b60b4d20c0140dd1f93d27c797a` | `6d5bac434f8affce6eb1e37643e7b1aae0b398d4c827eb1c19cf365dfc819a` / `8f7b67e4fc22d05bebbd7b614eea45cab25c651eca7fbe3e53af116fb2be9931` |

The exact author/provider record for the retained repository artwork is not embedded in git history, so this document does not claim third-party licensing evidence that the repository does not contain. If external redistribution requires stronger provenance, regenerate the affected art through the approved image pipeline and append the generation record before replacing it.

Visible runtime UI uses the real chamber raster, Lucide icons and the shared official GAS `CoinArt`. It does not present emoji, ASCII artwork, CSS/div illustrations, inline SVG drawings or copied upstream game assets as product art.
