type PublishAssets = { icon?: string; banner?: string };

type PublishValidationInput = {
  entryUrl: string;
  cdnBaseUrl?: string | null;
  cdnRootUrl?: string | null;
  assets?: PublishAssets | null;
};

type PublishValidationResult = { valid: boolean; errors: string[] };

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUnderBase(value: string, base?: string | null): boolean {
  if (!base) return true;
  try {
    const url = new URL(value);
    const baseUrl = new URL(base);
    if (url.origin !== baseUrl.origin) return false;
    const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;
    return url.pathname === baseUrl.pathname || url.pathname.startsWith(basePath);
  } catch {
    return false;
  }
}

function isSameOrigin(value: string, base?: string | null): boolean {
  if (!base) return true;
  try {
    const url = new URL(value);
    const baseUrl = new URL(base);
    return url.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

export function validatePublishPayload(input: PublishValidationInput): PublishValidationResult {
  const errors: string[] = [];
  if (!input.entryUrl || !isHttpsUrl(input.entryUrl)) {
    errors.push("entry_url must be an https URL");
  } else if (!isUnderBase(input.entryUrl, input.cdnBaseUrl)) {
    errors.push("entry_url must be under CDN_BASE_URL");
  }

  if (input.cdnRootUrl && input.cdnBaseUrl && !isUnderBase(input.cdnBaseUrl, input.cdnRootUrl)) {
    errors.push("cdn_base_url must be under CDN_BASE_URL");
  }

  const assets = input.assets || {};
  for (const value of [assets.icon, assets.banner]) {
    if (!value) continue;
    if (!isHttpsUrl(value)) errors.push("assets_selected must be https URLs");
    else if (!isSameOrigin(value, input.cdnBaseUrl)) {
      errors.push("assets_selected must be on CDN_BASE_URL origin");
    }
  }

  return { valid: errors.length === 0, errors };
}
