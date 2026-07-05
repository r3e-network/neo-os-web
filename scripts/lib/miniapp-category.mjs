export const CATALOG_CATEGORIES = new Set([
  "gaming",
  "defi",
  "governance",
  "utility",
  "social",
  "nft",
  "data",
  "other",
]);

const CATEGORY_ALIASES = {
  game: "gaming",
  games: "gaming",
  finance: "defi",
  tool: "utility",
  tools: "utility",
  console: "utility",
  oracle: "data",
};

export function normalizeCatalogCategory(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (CATEGORY_ALIASES[raw]) return CATEGORY_ALIASES[raw];
  if (CATALOG_CATEGORIES.has(raw)) return raw;
  return "utility";
}
