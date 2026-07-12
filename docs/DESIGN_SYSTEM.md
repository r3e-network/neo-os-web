# Neo Soft — Unified Design System

Canonical, cross-repo design language for the Neo MiniApps ecosystem:

- `neo-miniapps-platform` — platform host (Next.js + Tailwind) + 77 miniapps (Vite/React + SCSS via `apps/shared/styles`)
- `neo-abstract-account` — AA frontend (Vue 3 + Tailwind)
- `neo-morpheus-oracle` — Oracle web (Next.js + custom CSS variables)

Inspiration: *E-Robo Wallet* crypto iOS UI kit — soft, friendly, professional fintech. Light canvas, white floating cards, generous radius, soft diffuse shadows, pastel icon badges, restrained navy CTAs, lots of whitespace.

> One palette, four token homes. Every surface references the same tokens so the whole ecosystem feels like one product.

---

## 1. Color

### Canvas & surface (light)
| Token | Hex | Use |
|---|---|---|
| `--ns-bg` | `#F4F5F7` | Page canvas (soft cool gray) |
| `--ns-bg-2` | `#ECEEF2` | Secondary canvas, insets behind cards |
| `--ns-surface` | `#FFFFFF` | Cards, sheets, nav |
| `--ns-surface-subtle` | `#F7F8FA` | Stat tiles, code blocks, inputs-on-card |
| `--ns-border` | `rgba(20,22,38,0.06)` | Hairline separators (prefer shadow over border) |
| `--ns-border-strong` | `rgba(20,22,38,0.10)` | Inputs, hover borders |

### Text (navy ink)
| Token | Hex | Use |
|---|---|---|
| `--ns-ink` | `#1E1E2E` | Primary text, headings, primary CTA bg |
| `--ns-text` | `#2A2D3D` | Body |
| `--ns-text-2` | `#5B6478` | Secondary |
| `--ns-text-muted` | `#8A92A6` | Muted / captions |
| `--ns-text-faint` | `#AEB4C2` | Disabled, placeholders |

### Brand & semantic
| Token | Hex | Use |
|---|---|---|
| `--ns-brand` | `#16C784` | Neo brand + positive / success |
| `--ns-brand-strong` | `#0FB174` | Brand hover |
| `--ns-brand-soft` | `#E4F8F0` | Brand tint bg |
| `--ns-violet` | `#7B61FF` | Interactive accent: links, focus, secondary |
| `--ns-violet-strong` | `#6A4DF4` | Violet hover |
| `--ns-violet-soft` | `#EEEAFF` | Violet tint bg |
| `--ns-up` / `--ns-success` | `#16C784` | Price up / success |
| `--ns-down` / `--ns-danger` | `#EA3943` | Price down / error |
| `--ns-danger-soft` | `#FDE7E9` | Error tint |
| `--ns-warning` | `#F5A623` | Warning |
| `--ns-warning-soft` | `#FFF3DD` | Warning tint |
| `--ns-info` | `#3E8CFF` | Info |
| `--ns-info-soft` | `#E6F0FF` | Info tint |
| `--ns-spark` | `#FF6B6B` | Sparkline / chart coral |

### Pastel icon-badge palette (E-Robo)
Circular badges behind coin/app icons. Cycle these for variety.

| Name | bg | fg (icon/text) |
|---|---|---|
| peach | `#FFE4C3` | `#E8923B` |
| mint | `#D5EEC9` | `#3FA66A` |
| lavender | `#E0E2FF` | `#6A6CF0` |
| sky | `#DFF0FF` | `#3E8CFF` |
| rose | `#FFEBE4` | `#F0795B` |
| lilac | `#EDE4FF` | `#8B6CF0` |
| seafoam | `#DEF5E9` | `#16C784` |

### Gradients
- Hero (AI/promo card): `linear-gradient(135deg, #8B7BF0 0%, #A99CF5 100%)` — white text
- Brand: `linear-gradient(135deg, #16C784 0%, #7B61FF 100%)`

---

## 2. Radius
| Token | px | Use |
|---|---|---|
| `--ns-radius-xs` | 8 | chips, small controls |
| `--ns-radius-sm` | 12 | inner elements |
| `--ns-radius-md` | 16 | inputs, secondary cards |
| `--ns-radius-lg` | 20 | **default card** |
| `--ns-radius-xl` | 24 | hero, modal |
| `--ns-radius-full` | 9999 | pills, badges, icon badges, primary CTA |

## 3. Shadow (soft, navy-tinted — never pure black)
| Token | Value |
|---|---|
| `--ns-shadow-xs` | `0 1px 2px rgba(20,22,38,0.04)` |
| `--ns-shadow-sm` | `0 2px 8px rgba(20,22,38,0.05)` |
| `--ns-shadow-md` | `0 8px 24px rgba(20,22,38,0.06)` ← default card |
| `--ns-shadow-lg` | `0 16px 40px rgba(20,22,38,0.10)` ← hover/raised |
| `--ns-shadow-xl` | `0 24px 60px rgba(20,22,38,0.14)` ← modal |
| `--ns-focus-ring` | `0 0 0 4px rgba(123,97,255,0.18)` |
| `--ns-glow-brand` | `0 8px 24px rgba(22,199,132,0.20)` (sparing) |

## 4. Typography
- Sans: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Mono: `"JetBrains Mono", "SF Mono", Consolas, monospace` (addresses, hashes, numbers)
- Scale: Display 32/800/-0.02em · H1 28/800 · H2 22/700 · H3 18/700 · Body 15/400-500 (lh 1.5) · Small 13 · Caption 12 · **Eyebrow** 11/700 uppercase ls 0.12em muted
- Numbers: `font-variant-numeric: tabular-nums`

## 5. Motion
- `--ns-t-fast` 150ms · `--ns-t` 220ms · `--ns-t-slow` 320ms
- ease-smooth `cubic-bezier(0.4,0,0.2,1)` · ease-snappy `cubic-bezier(0.34,1.56,0.64,1)`
- Respect `prefers-reduced-motion`.

## 6. Spacing
4px base scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. Cards pad 20–24. Page gutters 16 (mobile) → 24/40 (desktop).

---

## 7. Component recipes

- **Card**: `--ns-surface`, radius `lg`(20), `--ns-shadow-md`, no border (optional hairline), pad 20–24. Hover (interactive): `--ns-shadow-lg` + `translateY(-2px)`.
- **Button / primary**: bg `--ns-ink`, white text, pill, 12×20, 700; hover `#2A2A40`; active `translateY(1px)`; disabled `--ns-surface-subtle`/faint.
- **Button / brand**: bg `--ns-brand`, white text; hover `--ns-brand-strong`.
- **Button / secondary**: `--ns-surface`, ink text, hairline border, pill; hover `--ns-surface-subtle` + `--ns-border-strong`.
- **Button / ghost**: transparent, violet text; hover `--ns-violet-soft`.
- **Input/select**: `--ns-surface`, radius `md`(16), `--ns-border-strong`, 12×14; focus violet border + `--ns-focus-ring`; placeholder faint.
- **IconBadge**: circle 40–44px, pastel bg+fg from palette; holds a logo/lucide icon.
- **StatTile**: `--ns-surface-subtle`, radius `md`, pad 14–16; eyebrow label + bold mono value.
- **Badge/pill**: radius full; soft tinted bg + colored text — success/warning/danger/info/neutral.
- **ListRow**: IconBadge + title/subtitle + trailing value or sparkline; hairline divider; hover `--ns-surface-subtle`.
- **HeroCard**: hero gradient, white text, radius `xl`, optional illustration, pill CTA.
- **Nav** (top or bottom): `--ns-surface`, `--ns-shadow-sm`; active = ink + brand/violet accent.
- **EmptyState / Skeleton**: muted centered copy / shimmer on `--ns-surface-subtle`.

---

## 8. Token homes (implementation map)

| Repo / surface | File(s) | Mechanism |
|---|---|---|
| Platform shared (77 miniapps) | `apps/shared/styles/theme-base.scss` (CSS vars = source of truth) + `tokens.scss`, `_pm-light.scss`, `_console-common.scss`, `_playarea-base.scss`, `_hero.scss`, `mixins.scss`, `_responsive-card.scss`, `desktop-theme.scss` | SCSS partials + CSS custom properties |
| Platform host | `platform/host-app/tailwind.config.js` + `styles/globals.css` | Tailwind theme + CSS vars |
| AA frontend | `neo-abstract-account/frontend/tailwind.config.js` + `src/style.css` | Tailwind theme + CSS vars |
| Oracle web | `neo-morpheus-oracle/apps/web/app/globals.css` | CSS vars |

Each home re-declares the **same** values under both the canonical `--ns-*` names and the home's existing semantic names (`--bg-card`, `--text-primary`, Tailwind `colors`, etc.) so existing components inherit the new look without per-component edits.

## 9. Verification gates
- Build green per surface (miniapp export build, host `next build`, AA/Oracle `build`).
- `npm run audit:miniapps:layout` passes (platform).
- Before/after screenshots per representative surface, compared to the E-Robo reference.
- Existing vitest suites pass.
</invoke>
