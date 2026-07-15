/**
 * Burn League Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (burn, leaderboard, stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Docs / how-it-works section
 *   - Feature flags (fireworks, wallet requirement, etc.)
 *
 * The miniapp itself only provides PlayArea.vue (the unique burn UI)
 * and useBurnLeague.ts (domain logic). Everything else is driven by this file.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // ── Identity ─────────────────────────────────────────────────────────
  name: "Burn League",
  description: "Practice a local fire streak or join the verified TestNet GAS league",
  icon: "flame",
  category: "game",
  // shell "game" gives the focused launch page that renders the two-mode entry
  // (primary "Earn GAS" / secondary "Play free") wired by the shared launcher.
  shell: "game",

  // Two-mode opt-in (burn-league has no full gamePage block, so use the
  // top-level flag). Enables the guest "Play free" CTA alongside the GameFi one.
  supportsGuest: true,
  // Paid play is intentionally TestNet-only. Runtime contract identity and
  // season-duration gates reject the legacy two-minute MainNet deployment.
  supportsGameFi: true,

  // A paid-vs-local choice is a meaningful safety gate for this irreversible
  // contest, so keep the designed launcher and make every visible line locale
  // driven instead of falling back to the English manifest identity.
  gamePage: {
    heroBadgeKey: "launchBadge",
    heroTitleKey: "launchTitle",
    heroDescKey: "launchDescription",
    primaryLabelKey: "launchPrimary",
    ghostLabelKey: "rulesTitle",
    // The details accordion resolves its title from featuresTitle -> rules title
    // -> ctaTitle, and its hint from featuresEyebrow -> rules title -> ctaTitle.
    // Declaring neither meant both fell through to ctaTitle, so the row printed
    // "Ready to fuel the arena?" in bold with the identical sentence as its hint
    // directly beneath. Give the hint its own copy: it should preview what the
    // row opens, not echo the heading.
    featuresEyebrowKey: "launchDetailsHint",
    ctaTitleKey: "launchCtaTitle",
    ctaDescKey: "launchCtaDesc",
    trustBadgeKeys: ["launchTrustChain", "launchTrustWallet", "launchTrustResult"],
    categoryColor: "#0f9f78",
    appIcon: "flame",
    modes: { guest: true, gamefi: true },
  },

  // ── Tabs ──────────────────────────────────────────────────────────────
  // The platform appends a "docs" tab automatically via defineMiniApp.
  tabs: [
    { key: "burn", labelKey: "burnTokens", icon: "flame", default: true },
    { key: "leaderboard", labelKey: "leaderboard", icon: "bar-chart" },
    { key: "stats", labelKey: "stats", icon: "trending-up" },
  ],

  // ── Stats Grid ────────────────────────────────────────────────────────
  // Rendered inside the stats tab. Each entry binds an i18n label key to a
  // reactive state key from the setup() return value. The platform looks up
  // `state[valueKey].value` and formats it according to `format`.
  stats: [
    { labelKey: "totalBurned", valueKey: "totalBurned", format: "gas", variant: "danger", icon: "flame" },
    { labelKey: "youBurned", valueKey: "userBurned", format: "gas", variant: "accent", icon: "zap" },
    { labelKey: "rank", valueKey: "formattedRank", format: "text", icon: "award" },
    { labelKey: "sidebarBurns", valueKey: "burnCount", format: "number", icon: "hash" },
    { labelKey: "sidebarRewardPool", valueKey: "rewardPool", format: "gas", variant: "success", icon: "gift" },
    { labelKey: "leaderboard", valueKey: "leaderboardSize", format: "number", icon: "users" },
  ],

  // ── Sidebar ───────────────────────────────────────────────────────────
  // Persistent info panel on the left. Values are resolved from the same
  // reactive state object returned by setup(). The `format` field controls
  // how the value is displayed (number, gas, text, etc.).
  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "totalBurned", valueKey: "totalBurnedDisplay", format: "text" },
      { labelKey: "youBurned", valueKey: "userBurnedDisplay", format: "text" },
      { labelKey: "sidebarRank", valueKey: "formattedRank", format: "text" },
      { labelKey: "sidebarBurns", valueKey: "burnCount", format: "number" },
      { labelKey: "sidebarRewardPool", valueKey: "rewardPoolDisplay", format: "text" },
    ],
  },

  // ── Features ──────────────────────────────────────────────────────────
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // ── Docs (How It Works) ───────────────────────────────────────────────
  // Array of documentation sections rendered in the docs tab.
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // ── Contract ──────────────────────────────────────────────────────────
  // The burn league uses a custom payment flow (direct GAS transfer
  // to contract with memo), not the standard operation-box pattern.
  contract: {
    mode: "custom",
  },

  // ── Permissions ───────────────────────────────────────────────────────
  permissions: {
    payments: true,
  },
};
