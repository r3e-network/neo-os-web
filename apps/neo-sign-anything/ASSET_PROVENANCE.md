# Neo Signature Desk asset provenance

All runtime media is served from this miniapp's `public/` directory. The app does not fetch visual assets from a third-party host.

| Asset | Product use | Repository provenance | Runtime status |
| --- | --- | --- | --- |
| `signature-desk.webp` | Foreground signing-desk scene and catalog/social banner | Repository-local illustration introduced as `signature-desk.jpg` in commit `c95b13060a691e8bb3f3df41edc8bb49058b3f94`, then converted to WebP in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | Loaded by `src/PlayArea.tsx` and selected by the manifest/Open Graph metadata; 1672×941, about 58 KB |
| `sign-scene-art.webp` | Earlier square alternate scene | Generated through the repository scene-art pipeline with the app prompt `signing document with pen and wax seal, warm bright tool`; introduced in commit `8c821a63448a78254b1a102ab6275604717586ac` and converted to WebP in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | Retained for source history; not loaded by the production surface |
| `logo.svg`, `banner.svg` | Legacy catalog identity masters | Repository catalog assets introduced in commit `c1e62a04b7481b60b4d20c0140dd1f93d27c797a` | Retained for source history; not selected by the production manifest |
| `logo.webp`, `logo.avif` | Optimized catalog icon variants | Generated from the project catalog master in commit `0098cd946f09b0f874cf63fe3b24128e939c65f4` | Manifest selects `logo.webp`; AVIF remains an optional catalog variant |
| `banner.webp`, `banner.avif` | Legacy text-heavy catalog banner variants | Generated from the project catalog master in commit `0098cd946f09b0f874cf63fe3b24128e939c65f4` | Retained for compatibility; the production manifest now uses the application scene instead |

No asset in this directory was copied from `IcedSoul/minigame-everyday`; that game reference repository is not relevant to this signing utility.
