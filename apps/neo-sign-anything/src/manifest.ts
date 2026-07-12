import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Neo Signature Desk",
  description: "Review exact UTF-8 payloads and capture Neo N3 wallet signature records",
  icon: "pen-tool",
  category: "tool",
  shell: "launcher",
  theme: {
    family: "default",
    accentColor: "#17734b",
    density: "comfortable",
  },

  // The app-owned desk already renders the composer, exact payload, wallet
  // context, record, encoding options, and local history. Empty shell chrome
  // prevents a second generic form/dashboard from competing with that flow.
  tabs: [],
  stats: [],
  sidebar: {
    titleKey: "title",
    items: [],
  },

  features: { walletRequired: false, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "messageHint", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // Message signing is declared by neo-manifest.json. This internal capability
  // map only needs local storage for metadata-only history; there is no app
  // contract, transaction, oracle, payment, or data-feed integration.
  permissions: { storage: true },
};
