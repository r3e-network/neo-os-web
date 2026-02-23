import type { MiniAppMediaUploadVariant } from "@/lib/hooks/useMiniApps";

export type MediaVariant = {
  url: string;
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
};

type MediaVariantIdentity = Pick<MiniAppMediaUploadVariant, "theme" | "density" | "locale">;

export function parseJSONObjectText(input: string, fieldName: string): Record<string, unknown> {
  const source = String(input || "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${fieldName} parse error: ${detail}`);
  }
}

export function parseJSONVariantArray(input: string, fieldName: string): MediaVariant[] {
  const source = String(input || "").trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array`);
    }
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => item as MediaVariant)
      .filter((item) => typeof item.url === "string" && item.url.trim().length > 0)
      .map((item) => {
        const themeRaw = typeof item.theme === "string" ? item.theme.trim().toLowerCase() : "";
        const densityRaw = typeof item.density === "string" ? item.density.trim().toLowerCase() : "";
        return {
          url: String(item.url).trim(),
          theme: themeRaw === "light" || themeRaw === "dark" || themeRaw === "any" ? themeRaw : undefined,
          density: densityRaw === "1x" || densityRaw === "2x" || densityRaw === "3x" ? densityRaw : undefined,
          locale: typeof item.locale === "string" ? item.locale.trim() || undefined : undefined,
        };
      });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${fieldName} parse error: ${detail}`);
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

function variantIdentityKey(variant: MediaVariantIdentity): string {
  return `${variant.theme || ""}|${variant.density || ""}|${variant.locale || ""}`;
}

export function normalizeMediaUploadVariant(input: MiniAppMediaUploadVariant | undefined): MediaVariantIdentity | null {
  if (!input) return null;
  const themeRaw = String(input.theme || "").trim().toLowerCase();
  const densityRaw = String(input.density || "").trim().toLowerCase();
  const localeRaw = String(input.locale || "").trim().toLowerCase();

  const normalized: MediaVariantIdentity = {};
  if (themeRaw === "light" || themeRaw === "dark" || themeRaw === "any") normalized.theme = themeRaw;
  if (densityRaw === "1x" || densityRaw === "2x" || densityRaw === "3x") normalized.density = densityRaw;
  if (localeRaw) normalized.locale = localeRaw.slice(0, 16);
  if (!normalized.theme && !normalized.density && !normalized.locale) return null;
  return normalized;
}

export function upsertVariantJSON(input: string, fieldName: string, variant: MediaVariant): string {
  const existing = (() => {
    try {
      return parseJSONVariantArray(input, fieldName);
    } catch {
      return [] as MediaVariant[];
    }
  })();
  const key = variantIdentityKey(variant);

  let replaced = false;
  const next: MediaVariant[] = [];
  for (const item of existing) {
    if (variantIdentityKey(item) === key) {
      if (!replaced) {
        next.push(variant);
        replaced = true;
      }
      continue;
    }
    next.push(item);
  }

  if (!replaced) {
    next.unshift(variant);
  }

  return JSON.stringify(next, null, 2);
}
