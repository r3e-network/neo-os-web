# Attribution and adaptation notes

## Mechanic reference

- Project: `IcedSoul/minigame-everyday`, Day 03 Arrow
- URL: <https://github.com/IcedSoul/minigame-everyday/tree/73bb72fa6b144148fc7c7e93c83ffd47f3d9f173/day-03-arrow>
- Audited commit: `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`
- Upstream README license statement: MIT
- Upstream caveat: the audited snapshot has no standalone `LICENSE`, `NOTICE`,
  or per-image provenance manifest.

This app adapts the escape-ray dependency idea: edge `A → B` means arrow A must
wait for B, and cyclic layouts are rejected. The implementation is a new
TypeScript engine with a seeded PRNG, deterministic 2×N tiling, acyclic
orientation search, solution witness, witness verifier, malformed-state
rejection, pause-safe clock, replay, and recovery validation. It does not copy
the upstream browser bootstrap, timer code, scene drawing code, or assets. The
upstream `index.html` was not used because its imported `Main` class is never
instantiated and therefore renders a blank browser page.

## Original production art

The following files were generated specifically for Garden Arrowworks on
2026-07-10 with OpenAI image generation, then resized or background-keyed for
the Phaser runtime. The retained high-resolution sources are in the local
ImageGen output directory
`/Users/jinghuiliao/.codex/generated_images/019f4b9f-157a-73d0-942d-e96920706a8d/`:

| Shipped file | Generated source |
| --- | --- |
| `public/art/garden-board.webp` | `exec-e9a2b5d7-8adf-4e54-8506-4ce6763e5a68.png` |
| `public/art/jade-shaft.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/art/jade-tail.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/art/jade-head.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/art/coral-shaft.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/art/coral-tail.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/art/coral-head.png` | `exec-83753082-9ced-4808-b4fa-e2de9b82ff2c.png` atlas |
| `public/logo.webp` | `exec-ac1efe69-9758-4d89-bfa1-b15a87a240ec.png` |
| `public/banner.webp` | `exec-d11ffbb2-37e4-4e6d-8964-b36c8cdb63c4.png` |

The garden-board source above is the final non-gridded foreground plate used
in production; it supersedes the earlier exploration
`exec-b5b538bd-3728-4884-9180-d9234e0b5286.png`. The visual-direction concept
`exec-25d1729d-25a8-4f63-98f6-0ee208eb5c40.png` informed composition only and
is not shipped.

No artwork from the upstream repository was copied. HUD controls use the
project's installed Lucide icon library; gameplay text and controls remain
code-native.
