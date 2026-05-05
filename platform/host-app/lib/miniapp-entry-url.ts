const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";
const CUSTOM_HOST_PATTERN = /^(?:[a-z0-9-]+\.)+(?:matrix|neo)(?::\d+)?(?:[/?#].*)?$/i;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/?#].*)?$/i;

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function maybePrefixEntryUrlScheme(raw: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  if (CUSTOM_HOST_PATTERN.test(raw)) return `https://${raw}`;
  if (LOCAL_HOST_PATTERN.test(raw)) return `http://${raw}`;
  return raw;
}

export function normalizeMiniAppEntryUrl(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  if (raw.startsWith("mf://")) {
    return raw;
  }

  if (raw.startsWith("/miniapps/")) {
    return raw;
  }

  try {
    const parsed = new URL(maybePrefixEntryUrlScheme(raw));
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeMiniAppDappUrl(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw || raw.startsWith("mf://")) return null;

  if (raw.startsWith("/miniapps/")) {
    return raw;
  }

  try {
    const parsed = new URL(maybePrefixEntryUrlScheme(raw));
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isManifestMiniAppEntryUrl(entryUrl: string): boolean {
  return String(entryUrl || "").trim().startsWith("mf://manifest?");
}

export function resolveMiniAppEntryUrlOrManifest(rawEntryUrl: unknown, appId: string): string {
  return normalizeMiniAppEntryUrl(rawEntryUrl) || `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
}
