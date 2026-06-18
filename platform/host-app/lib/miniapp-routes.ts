const ONEGATE_VAULT_HOST_DETAIL_IDS = new Set([
  "miniapp-gas-lucky-pool",
  "miniapp-onegate-vault",
  "onegate-vault",
]);

type QueryValue = string | number | boolean | null | undefined;

function appendQuery(
  href: string,
  query?: string | URLSearchParams | Record<string, QueryValue>,
): string {
  if (!query) return href;
  if (typeof query === "string") {
    const trimmed = query.trim().replace(/^\?/, "");
    return trimmed ? `${href}?${trimmed}` : href;
  }
  const params =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(
          Object.entries(query)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        );
  const serialized = params.toString();
  return serialized ? `${href}?${serialized}` : href;
}

export function buildMiniAppDetailHref(
  appId: string,
  query?: string | URLSearchParams | Record<string, QueryValue>,
): string {
  const encodedAppId = encodeURIComponent(appId);
  const base = ONEGATE_VAULT_HOST_DETAIL_IDS.has(appId)
    ? `/miniapp-detail/${encodedAppId}`
    : `/miniapps/${encodedAppId}`;
  return appendQuery(base, query);
}
