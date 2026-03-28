import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  name: "Event Ticket Pass",
  description: "Create events and issue NFT tickets",
  icon: "ticket",
  category: "social",
  shell: "launcher",

  tabs: [
    { key: "create", labelKey: "createTab", icon: "plus", default: true },
    { key: "tickets", labelKey: "ticketsTab", icon: "ticket" },
    { key: "checkin", labelKey: "checkinTab", icon: "check-circle" },
  ],

  stats: [
    { labelKey: "sidebarEvents", valueKey: "eventsCount", format: "number", icon: "calendar" },
    { labelKey: "sidebarTickets", valueKey: "ticketsCount", format: "number", icon: "ticket" },
    { labelKey: "sidebarActive", valueKey: "activeEventsCount", format: "number", variant: "success", icon: "check-circle" },
  ],

  sidebar: {
    titleKey: "title",
    items: [
      { labelKey: "sidebarEvents", valueKey: "eventsCount", format: "number" },
      { labelKey: "sidebarTickets", valueKey: "ticketsCount", format: "number" },
      { labelKey: "sidebarActive", valueKey: "activeEventsCount", format: "number" },
    ],
  },

  features: { walletRequired: true, chainWarning: true },

  docs: [
    { titleKey: "title", contentKey: "subtitle", type: "text" },
  ],

  permissions: { payments: true },

  contract: { mode: "custom" },
};
