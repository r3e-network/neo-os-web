type CanonicalizeMiniAppIdOptions = {
  fallbackSlug?: string;
  coerceMiniappPrefix?: boolean;
};

const MINIAPP_PREFIX = "miniapp-";
const MINIAPP_SLUG_ALIAS_MAP: Record<string, string> = {
  "fogplay": "fogplay",
  "coin-flip": "fogplay",
  "coinflip": "fogplay",
  "dice-game": "dicegame",
  "daily-checkin": "dailycheckin",
  "doomsday-clock": "last-survivor",
  "lastsurvivor": "last-survivor",
  "neo-gacha": "gasbox",
  "prediction-market": "predictionmarket",
  "red-envelope": "redenvelope",
  "secret-vote": "secretvote",
  "stream-vault": "neo-pay",
  "gasbox": "gasbox",
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
  if (normalized.startsWith("miniapp_")) {
    normalized = `${MINIAPP_PREFIX}${normalized.slice("miniapp_".length)}`;
  } else if (normalized.startsWith("miniapp") && !normalized.startsWith(MINIAPP_PREFIX)) {
    normalized = `${MINIAPP_PREFIX}${normalized.slice("miniapp".length).replace(/^[-_]+/, "")}`;
  }

  const prefixed = normalized.startsWith(MINIAPP_PREFIX);
  const slug = prefixed ? normalized.slice(MINIAPP_PREFIX.length) : normalized;
  const mappedSlug = MINIAPP_SLUG_ALIAS_MAP[slug] || slug;
  if (prefixed) {
    return mappedSlug ? `${MINIAPP_PREFIX}${mappedSlug}` : fallbackAppId(options.fallbackSlug);
  }

  const mappedUnprefixed = MINIAPP_SLUG_ALIAS_MAP[normalized];
  if (mappedUnprefixed) {
    return `${MINIAPP_PREFIX}${mappedUnprefixed}`;
  }

  if (options.coerceMiniappPrefix && normalized && !normalized.startsWith(MINIAPP_PREFIX)) {
    const cleaned = normalized.replace(/^[-_]+/, "");
    if (!cleaned) return fallbackAppId(options.fallbackSlug);
    return `${MINIAPP_PREFIX}${MINIAPP_SLUG_ALIAS_MAP[cleaned] || cleaned}`;
  }

  if (!normalized) return fallbackAppId(options.fallbackSlug);
  return normalized;
}
