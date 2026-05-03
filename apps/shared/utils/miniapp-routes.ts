export function buildMiniAppUrl(
  appId: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const normalizedAppId = String(appId || "").trim();
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized) continue;
    params.set(key, normalized);
  }

  const basePath = `/miniapps/${normalizedAppId}`;
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
