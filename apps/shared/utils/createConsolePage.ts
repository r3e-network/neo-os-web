import { createMiniApp } from "./createMiniApp";

type ConsoleSidebarItem = {
  labelKey: string;
  value: () => string | number | boolean | null | undefined;
};

export function createConsolePage(config: {
  name: string;
  messages: Record<string, unknown>;
  tab: { key: string; labelKey: string; icon: string };
  sidebarItems: ConsoleSidebarItem[];
}) {
  return createMiniApp({
    name: config.name,
    messages: config.messages,
    template: {
      tabs: [{ ...config.tab, default: true }],
      docSubtitleKey: "docsSubtitle",
      docFeatureCount: 3,
    },
    sidebarItems: config.sidebarItems,
  });
}
