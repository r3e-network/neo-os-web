import { ReactNode } from "react";

/**
 * Blueprint Layout Types
 * Polymarket-style generic layouts for miniapps
 */

export type BlueprintLayout = 
  | "default" 
  | "trading" 
  | "voting" 
  | "gaming" 
  | "info";

export type TabConfig = {
  id: string;
  label: string;
  type: "content" | "forum" | "reviews" | "news" | "custom";
  content?: ReactNode;
};

export type OperationPanelConfig = {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  position?: "right" | "bottom";
  collapsible?: boolean;
  sticky?: boolean;
};

export type HeroConfig = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  disclaimer?: string;
  image?: string;
};

export type StatsDisplayConfig = {
  items: Array<{
    key: string;
    label: string;
    format?: "number" | "currency" | "percent" | "date";
  }>;
  refreshInterval?: number;
};

export type BlueprintConfig = {
  layout: BlueprintLayout;
  hero?: HeroConfig;
  tabs?: TabConfig[];
  operationPanel?: OperationPanelConfig;
  statsDisplay?: StatsDisplayConfig;
  leftPanel?: {
    width?: string;
    components?: string[];
  };
  rightPanel?: {
    width?: string;
    sticky?: boolean;
  };
};

/**
 * Default Blueprint Configurations
 */
export const DEFAULT_BLUEPRINTS: Record<BlueprintLayout, BlueprintConfig> = {
  default: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "forum", label: "Forum", type: "forum" },
    ],
    operationPanel: {
      title: "Operations",
      subtitle: "Configure and submit",
      ctaLabel: "Launch",
    },
  },
  trading: {
    layout: "trading",
    hero: {
      eyebrow: "Trading Platform",
      disclaimer: "Trade at your own risk",
    },
    tabs: [
      { id: "markets", label: "Markets", type: "content" },
      { id: "history", label: "History", type: "content" },
      { id: "comments", label: "Comments", type: "forum" },
    ],
    operationPanel: {
      title: "Trade",
      subtitle: "Select market, set amount, trade",
      ctaLabel: "Place Order",
      position: "right",
      sticky: true,
    },
    leftPanel: {
      width: "flex-1",
    },
    rightPanel: {
      width: "360px",
      sticky: true,
    },
  },
  voting: {
    layout: "voting",
    hero: {
      eyebrow: "Voting",
      disclaimer: "One vote per address",
    },
    tabs: [
      { id: "proposals", label: "Proposals", type: "content" },
      { id: "results", label: "Results", type: "content" },
      { id: "discussion", label: "Discussion", type: "forum" },
    ],
    operationPanel: {
      title: "Cast Vote",
      subtitle: "Select option and vote",
      ctaLabel: "Vote",
    },
  },
  gaming: {
    layout: "gaming",
    hero: {
      eyebrow: "Gaming",
    },
    tabs: [
      { id: "play", label: "Play", type: "content" },
      { id: "leaderboard", label: "Leaderboard", type: "content" },
      { id: "rules", label: "Rules", type: "content" },
    ],
    operationPanel: {
      title: "Play",
      subtitle: "Start playing",
      ctaLabel: "Start",
    },
  },
  info: {
    layout: "info",
    tabs: [
      { id: "about", label: "About", type: "content" },
      { id: "docs", label: "Docs", type: "content" },
      { id: "support", label: "Support", type: "forum" },
    ],
    operationPanel: {
      title: "Get Started",
      ctaLabel: "Learn More",
    },
  },
};

export function getBlueprintConfig(layout: BlueprintLayout): BlueprintConfig {
  return DEFAULT_BLUEPRINTS[layout] || DEFAULT_BLUEPRINTS.default;
}

export function mergeBlueprintConfig(
  base: BlueprintConfig,
  overrides: Partial<BlueprintConfig>
): BlueprintConfig {
  return {
    ...base,
    ...overrides,
    hero: { ...base.hero, ...overrides.hero },
    tabs: overrides.tabs ?? base.tabs,
    operationPanel: { 
      ...base.operationPanel, 
      ...overrides.operationPanel 
    },
  };
}
