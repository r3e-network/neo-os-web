export type MiniAppLayout = "web" | "mobile";

type LayoutOverride = string | string[] | null | undefined;

type ResolveLayoutOptions = {
  override?: LayoutOverride;
  isMobileDevice?: boolean;
  hasWalletProvider?: boolean;
};

export function parseLayoutParam(value: LayoutOverride): MiniAppLayout | null {
  if (Array.isArray(value)) return parseLayoutParam(value[0]);
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "web" || normalized === "mobile") return normalized;
  return null;
}

export function resolveMiniAppLayout(options: ResolveLayoutOptions = {}): MiniAppLayout {
  const override = parseLayoutParam(options.override ?? null);
  if (override) return override;
  return options.isMobileDevice && options.hasWalletProvider ? "mobile" : "web";
}
