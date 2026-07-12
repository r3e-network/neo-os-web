# Neo X Bridge asset provenance

Checked: 2026-07-12

## Active runtime assets

| Asset | Provenance | Runtime role |
| --- | --- | --- |
| `public/bridge-route.webp` | Generated with OpenAI ImageGen for this miniapp on 2026-07-12. Master: `/Users/jinghuiliao/.codex/generated_images/019f53d7-9b2c-7793-aeaa-84d5cd52796c/exec-ee7f69b2-5b8b-42e9-852e-894b709ace3f.png`. The prompt explicitly prohibited text, logos, token marks, fake UI, and watermarks. | Low-interference PlayArea environment artwork |
| `public/banner.webp`, `public/banner.avif` | Deterministic 1440×640 crops of the same generated bridge master. | Catalog and social banner formats |
| `public/logo.webp`, `public/logo.avif` | Generated with OpenAI ImageGen for this miniapp on 2026-07-12. Master: `/Users/jinghuiliao/.codex/generated_images/019f53d7-9b2c-7793-aeaa-84d5cd52796c/exec-e29821bb-e3a8-4ab2-bfb6-69114bd884fb.png`. The prompt prohibited text, letters, logos, token symbols, and imitation brand marks. | App icon formats |
| `public/neo-x-mark.svg` | Official Neo X X-Mark, retained as an external image asset without redrawing. Brand reference: <https://x.neo.org/assets/brand/NeoX-BrandBook-v0.1.pdf>. | Neo X chain node mark |
| Shared `CoinArt` NEO/GAS images | `apps/shared/assets/tokens/neo-icon.svg` and `gas-icon.svg`, documented in code as Neo Press Kit assets. | Official NEO/GAS marks in the asset selector, route packet, and balances |
| Lucide React icons | `lucide-react`; no emoji, text glyph, inline SVG, or handcrafted icon substitutes. | Controls and state indicators |

## Inactive legacy asset

- `public/bridge-scene-art.webp` is an older dark bridge illustration. The current manifest, PlayArea, banner, and logo do not reference it. It is retained only as a scoped legacy file and must not be reintroduced without provenance review.

## Removed assets

- The former `banner.svg` and `logo.svg` were retired because they contained generated `NX` branding and a hard-coded TestNet presentation that did not represent the current multi-network product.
- The former route artwork was replaced because it baked approximate token marks and fake dashboards into the background.

No IcedSoul/minigame-everyday code or artwork is used by this miniapp.

## SHA-256 inventory

- `bridge-route.webp`: `973486d9ff0b732659204725af93425e67d61f03077a23a131c22912d6b658bb`
- `banner.webp`: `c396f2b917299409d297de3ae12cb99deae233260e01d3297a1af1da06ed12bd`
- `banner.avif`: `a10611907a932a227e928676ae47c1d5f7903a9d639e7773ab3b2708c7171de2`
- `logo.webp`: `bb0820e8434a89ae220b9f20d61c2a02a2c4fcae1a6f6b8edf422a17aff822eb`
- `logo.avif`: `126a48ea6996cba188e542c3f068a91044e80b6883ef6e5397c705e093fd2154`
- `neo-x-mark.svg`: `ed83fc172b26d0bad9bf0ecf7b6bc1360c4ea8d7c72b2cb199ed587c07996b2c`
