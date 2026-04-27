export type AdminNavigationItem = {
  readonly labelKey?: string;
  readonly labelFallback: string;
  readonly href: string;
  readonly icon: string;
};

export const ADMIN_NAVIGATION_ITEMS = [
  {
    labelKey: "navigation.dashboard",
    labelFallback: "Dashboard",
    href: "/",
    icon: "📊",
  },
  {
    labelKey: "navigation.services",
    labelFallback: "Services",
    href: "/services",
    icon: "🔧",
  },
  {
    labelKey: "navigation.simulations",
    labelFallback: "Simulations",
    href: "/simulations",
    icon: "🤖",
  },
  {
    labelKey: "navigation.miniapps",
    labelFallback: "MiniApps",
    href: "/miniapps",
    icon: "📱",
  },
  {
    labelKey: "navigation.templateStudio",
    labelFallback: "Template Studio",
    href: "/templates",
    icon: "🧱",
  },
  {
    labelKey: "navigation.users",
    labelFallback: "Users",
    href: "/users",
    icon: "👥",
  },
  {
    labelKey: "navigation.analytics",
    labelFallback: "Analytics",
    href: "/analytics",
    icon: "📈",
  },
  {
    labelKey: "navigation.contracts",
    labelFallback: "Contracts",
    href: "/contracts",
    icon: "📄",
  },
  {
    labelFallback: "Price Feeds",
    href: "/pricefeeds",
    icon: "📈",
  },
  {
    labelFallback: "Oracle Secrets",
    href: "/oracle-secrets",
    icon: "🔑",
  },
  {
    labelFallback: "Settings",
    href: "/settings",
    icon: "⚙️",
  },
] as const satisfies readonly AdminNavigationItem[];

export function resolveAdminNavigationLabel(
  item: AdminNavigationItem,
  translate: (key: string) => string,
) {
  return item.labelKey ? translate(item.labelKey) : item.labelFallback;
}
