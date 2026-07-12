# MiniApp Studio asset provenance

All production visuals are repository-local. The runtime does not load artwork
from third-party hosts.

| Asset | Product use | Repository provenance | Runtime facts |
| --- | --- | --- | --- |
| `miniapp-launch-studio.webp` | Main creation-stage artwork showing the four template workstations | Repository illustration introduced as `miniapp-launch-studio.jpg` in commit `d4096680a17c93bdab7161af6d6679e9354b5a50`; optimized WebP added in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | Loaded by `src/PlayArea.tsx`; 1672×941; SHA-256 `e321aca864ea003b9ffb3369f80462b42aa2e33da738ec761403e8e246d3964f` |
| `logo.svg`, `banner.svg` | Catalog identity masters | Repository catalog artwork tracked in project history from the initial MiniApp Factory asset set | SVG masters remain available for catalog surfaces |
| `logo.webp`, `banner.webp` | Optimized catalog identity | Repository-local WebP variants consolidated in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | Logo: 1024×1024, SHA-256 `fe99413513be906d82e0d9f00c1172d5ee0fc63d7a1ed833768a40e1de823e0f`; banner: 1200×480, SHA-256 `9c8e2143f950f173d71c8efb6952fbdb011a5d6ff5313de5e901bef972ec16c5` |

No asset in this app is copied from `IcedSoul/minigame-everyday`; that game
reference repository is not used by this application-creation utility.
