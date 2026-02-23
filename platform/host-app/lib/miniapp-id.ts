type CanonicalizeMiniAppIdOptions = {
  fallbackSlug?: string;
  coerceMiniappPrefix?: boolean;
};

const MINIAPP_PREFIX = "miniapp-";
const BUILTIN_PREFIX = "builtin-";
const MINIAPP_ID_ALIAS_MAP: Record<string, string> = {
  "builtin-lottery": "miniapp-lottery",
  "builtin-coin-flip": "miniapp-coinflip",
  "builtin-dice-game": "miniapp-dicegame",
  "builtin-prediction-market": "miniapp-predictionmarket",
  "builtin-red-envelope": "miniapp-redenvelope",
  "builtin-secret-vote": "miniapp-secretvote",
  "builtin-gas-spin": "miniapp-gacha",
  "miniapp-coin-flip": "miniapp-coinflip",
  "miniapp-dice-game": "miniapp-dicegame",
  "miniapp-prediction-market": "miniapp-predictionmarket",
  "miniapp-red-envelope": "miniapp-redenvelope",
  "miniapp-secret-vote": "miniapp-secretvote",
  "miniapp-gas-spin": "miniapp-gacha",
  "coin-flip": "miniapp-coinflip",
  "dice-game": "miniapp-dicegame",
  "prediction-market": "miniapp-predictionmarket",
  "red-envelope": "miniapp-redenvelope",
  "secret-vote": "miniapp-secretvote",
  "gas-spin": "miniapp-gacha",
  "neo-gacha": "miniapp-gacha",
};

function sanitizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackAppId(slug: unknown): string {
  const normalized = sanitizeSlug(slug);
  if (!normalized) return "";
  return `${MINIAPP_PREFIX}${normalized}`;
}

export function canonicalizeMiniAppId(
  rawAppId: unknown,
  options: CanonicalizeMiniAppIdOptions = {},
): string {
  const raw = String(rawAppId || "").trim().toLowerCase();
  if (!raw) {
    return fallbackAppId(options.fallbackSlug);
  }

  let normalized = raw;
  if (normalized.startsWith(BUILTIN_PREFIX)) {
    normalized = `${MINIAPP_PREFIX}${normalized.slice(BUILTIN_PREFIX.length)}`;
  }
  if (normalized.startsWith("miniapp_")) {
    normalized = `${MINIAPP_PREFIX}${normalized.slice("miniapp_".length)}`;
  } else if (normalized.startsWith("miniapp") && !normalized.startsWith(MINIAPP_PREFIX)) {
    normalized = `${MINIAPP_PREFIX}${normalized.slice("miniapp".length).replace(/^[-_]+/, "")}`;
  }

  const mapped = MINIAPP_ID_ALIAS_MAP[normalized];
  if (mapped) return mapped;

  if (options.coerceMiniappPrefix && normalized && !normalized.startsWith(MINIAPP_PREFIX)) {
    const cleaned = normalized.replace(/^[-_]+/, "");
    if (!cleaned) return fallbackAppId(options.fallbackSlug);
    return `${MINIAPP_PREFIX}${cleaned}`;
  }

  if (!normalized) return fallbackAppId(options.fallbackSlug);
  return normalized;
}
