/**
 * Daily Check-in Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the miniapp *except* the play area.
 *
 * The platform reads this manifest and renders:
 *   - Tabs (check-in, stats, docs)
 *   - Sidebar items bound to reactive state keys
 *   - Stats grid cards bound to reactive state keys
 *   - Docs / how-it-works section
 *   - Feature flags (fireworks, wallet requirement, etc.)
 *
 * The miniapp itself only provides PlayArea.vue (the unique check-in UI)
 * and useCheckin.ts (domain logic). Everything else is driven by this file.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

// Polymarket-style: a single dense focused screen. The PlayArea renders the
// streak ring, week grid, countdown, check-in CTA, stats, milestones, and
// history all inline. The shell does NOT need to add a redundant tab nav,
// sidebar info panel, or stats grid — those duplicate the PlayArea content.
export const manifest: MiniAppManifest = {
  name: "Daily Check-in",
  description: "Check in daily to earn GAS rewards",
  icon: "check-circle",
  category: "game",
  shell: "launcher",

  // No tabs. PlayArea is the only screen.
  tabs: [],

  // No outer stats grid — PlayArea renders its own "Your Stats" card.
  stats: [],

  // No outer sidebar — PlayArea is full-width.

  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // Docs deliberately empty so the shell does not auto-append a "docs" tab.
  docs: [],

  contract: {
    mode: "custom",
  },

  permissions: {
    payments: true,
  },
};
