# Daily Check-in asset provenance

Last reviewed: 2026-07-11

| Runtime asset | Role | Dimensions | Repository evidence |
| --- | --- | ---: | --- |
| `public/streak-plaza.webp` | Primary in-app seven-day ritual environment | 1672×941 | Project artwork present in repository snapshot `488fa04ec`; SHA-256 `796525742aa7138b6e9ff0bfa1e04a6d0fcffab3f7a2ee408388eb181caa5641`. |
| `public/banner.webp` / `.avif` | Catalog and launcher cover | 1200×720 | Existing project launcher family recorded in repository history; active WebP SHA-256 `2d030d32d9669097aa49fc54f6663e1f6014f7a958654c38d1329e1ebd29b683`. |
| `public/logo.webp` / `.avif` | Calendar-and-sun MiniApp identity | 512×512 | Existing project identity family recorded in repository history; active WebP SHA-256 `4519589dc538286dba1b952dd614fe24d69d0a97a96b2aef5d1e5596d95c7814`. |
| Shared `CoinArt` GAS token | Fee and milestone token mark | Shared runtime asset | Canonical GAS artwork from `apps/shared/art`; the MiniApp does not draw its own GAS logo. |

The plaza is used as the actual ritual environment beside the interactive
seven-day path, UTC window and reward milestone—not as a promotional image
pasted behind a parameter form. The interface uses the existing Lucide icon
dependency only for control and status semantics.

No code or visual resource was copied from `IcedSoul/minigame-everyday` or
another reference repository in this pass. Historical generation-provider
metadata is not asserted where it was not preserved.
