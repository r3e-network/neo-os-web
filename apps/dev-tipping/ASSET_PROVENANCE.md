# Developer Tipping asset provenance

## Selected product assets

| Asset | Product use | Repository provenance |
| --- | --- | --- |
| `public/support-board-stage.webp` | Primary in-app support-board scene and catalog/social cover | Existing project asset first tracked in repository commit `488fa04ec` on 2026-07-06. Reused in place; no external asset was copied during this pass. |
| `public/logo.webp` | MiniApp icon | Existing project asset with history in commits `ad52d3e2d`, `0098cd946`, and `488fa04ec`. |
| shared `CoinArt` GAS variant | GAS preset and transfer motion | Shared official-token component. Its source is guarded by `apps/shared/test/official-token-assets.test.tsx` against the Neo Press Kit GAS artwork. |
| Lucide icons | Controls, status, and navigation | Existing repository icon dependency; icons are not used as token art or developer avatars. |

## Unselected legacy assets

- `public/banner.webp` remains available for compatibility but is no longer the selected catalog or Open Graph image; its chart composition is less representative of the recipient-first support desk.
- `public/devtip-scene-art.webp` is not rendered. Its dark photographic cup scene conflicts with the warm, bright product direction.
- `public/banner.svg` and `public/logo.svg` are not rendered by the MiniApp. The production surface uses the tracked WebP assets and shared icon components.

No new image was generated, downloaded, or copied from an external reference repository in this production pass.
