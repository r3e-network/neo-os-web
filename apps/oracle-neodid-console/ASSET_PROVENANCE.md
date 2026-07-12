# Asset provenance

| Asset | In-app role | Repository history | Notes |
| --- | --- | --- | --- |
| `public/oracle-workspace-stage.webp` | Main warm NeoDID/Oracle workspace artwork and catalog banner | Added in repository commit `488fa04ec` | Repository-owned application artwork. Original generation/source metadata is not present beside the file. It is referenced directly without stretching or an artificial overlay asset. |
| `public/logo.webp`, `public/logo.avif` | Foreground evidence-pass and launcher mark | Generated with OpenAI ImageGen on 2026-07-11 from the active warm workspace and retired logo as visual references | The new mark depicts an identity evidence card passing through an Oracle/network inspection lens. It deliberately avoids a shield, lock, checkmark, token mark, text, and any claim that identity was verified. |

ImageGen master: `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-a19da1db-58a8-4fa2-bb05-95ad56356235.png`. Active raster SHA-256 values: `logo.webp` = `35c90c128e0c6626eef5cfdb8f053f60b8bbfd4f58f78d94a224eb133fd3c6c9`; `logo.avif` = `4dc658b7ff190e85798f7ef206baef3e3d94afa569119a7d141fa78584763a35`.

No external game, stock, token, or reference-repository artwork was added by the 2.1 pass. The older `banner.webp` contains stale OneGate / NEP-21 / Testnet labels and is no longer referenced by the manifest or Open Graph metadata. `neodid-identity-stage.webp`, `neodid-scene-art.webp`, and legacy banner variants remain packaged for compatibility but are not rendered in the primary workspace.
