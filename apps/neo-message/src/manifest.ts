/**
 * Neo Message Manifest
 *
 * Declarative config for the platform shell. The play area (compose + inbox) is
 * fully custom; the manifest supplies chrome, tabs and feature flags.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Message",
  description: "Encrypted and time-locked messaging on Neo X, secured by the Morpheus confidential oracle.",
  icon: "mail",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "compose", labelKey: "composeTab", icon: "edit", default: true },
    { key: "inbox", labelKey: "inboxTab", icon: "mail" },
  ],

  sidebar: {
    titleKey: "heroTitle",
    items: [],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "modeRecipient", contentKey: "recipientNote", type: "text" },
    { titleKey: "modeTimed", contentKey: "timedNote", type: "text" },
  ],

  contract: { mode: "custom" },

  permissions: { payments: true },
};
