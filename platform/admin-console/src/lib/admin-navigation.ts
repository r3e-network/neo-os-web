export type AdminNavigationIcon =
  | "analytics"
  | "contracts"
  | "dashboard"
  | "miniapps"
  | "priceFeeds"
  | "secrets"
  | "services"
  | "settings"
  | "simulations"
  | "templates"
  | "users";

export type AdminNavigationItem = {
  readonly labelKey?: string;
  readonly labelFallback: string;
  readonly href: string;
  readonly iconKey: AdminNavigationIcon;
};

export const ADMIN_NAVIGATION_ITEMS = [
  {
    labelKey: "navigation.dashboard",
    labelFallback: "Dashboard",
    href: "/",
    iconKey: "dashboard",
  },
  {
    labelKey: "navigation.services",
    labelFallback: "Services",
    href: "/services",
    iconKey: "services",
  },
  {
    labelKey: "navigation.simulations",
    labelFallback: "Simulations",
    href: "/simulations",
    iconKey: "simulations",
  },
  {
    labelKey: "navigation.miniapps",
    labelFallback: "MiniApps",
    href: "/miniapps",
    iconKey: "miniapps",
  },
  {
    labelKey: "navigation.templateStudio",
    labelFallback: "Template Studio",
    href: "/templates",
    iconKey: "templates",
  },
  {
    labelKey: "navigation.users",
    labelFallback: "Users",
    href: "/users",
    iconKey: "users",
  },
  {
    labelKey: "navigation.analytics",
    labelFallback: "Analytics",
    href: "/analytics",
    iconKey: "analytics",
  },
  {
    labelKey: "navigation.contracts",
    labelFallback: "Contracts",
    href: "/contracts",
    iconKey: "contracts",
  },
  {
    labelFallback: "Price Feeds",
    href: "/pricefeeds",
    iconKey: "priceFeeds",
  },
  {
    labelFallback: "Oracle Secrets",
    href: "/oracle-secrets",
    iconKey: "secrets",
  },
  {
    labelFallback: "Settings",
    href: "/settings",
    iconKey: "settings",
  },
] as const satisfies readonly AdminNavigationItem[];

export function resolveAdminNavigationLabel(
  item: AdminNavigationItem,
  translate: (key: string) => string,
) {
  return item.labelKey ? translate(item.labelKey) : item.labelFallback;
}
