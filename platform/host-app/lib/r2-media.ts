import crypto from "crypto";

export type MiniAppMediaAssetKind = "icon" | "logo" | "banner";
export type MiniAppMediaVariant = {
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
};

export type CreateMiniAppMediaUploadUrlInput = {
  app_id: string;
  asset_type: MiniAppMediaAssetKind;
  content_type: string;
  file_name?: string;
  variant?: MiniAppMediaVariant;
};

export type MiniAppMediaUploadUrlResult = {
  upload_url: string;
  public_url: string;
  key: string;
  expires_in: number;
  headers: Record<string, string>;
};

type R2MediaConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseURL: string;
  signedUrlTTL: number;
  host: string;
};

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE_MIME_PREFIX = "image/";
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "svg", "gif", "avif"]);
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeSignedUrlTTL(value: unknown): number {
  const raw = Number.parseInt(asTrimmedString(value), 10);
  if (!Number.isFinite(raw) || raw <= 0) return 900;
  return Math.max(60, Math.min(raw, 3600));
}

function parseConfig(): R2MediaConfig | null {
  const accountId = asTrimmedString(process.env.MINIAPP_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID);
  const accessKeyId = asTrimmedString(process.env.MINIAPP_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = asTrimmedString(process.env.MINIAPP_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY);
  const bucket = asTrimmedString(process.env.MINIAPP_R2_BUCKET) || "miniapps";

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const publicBaseURL = asTrimmedString(
    process.env.MINIAPP_MEDIA_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_MINIAPP_MEDIA_PUBLIC_BASE_URL ||
      "https://meshmini.app",
  ).replace(/\/+$/, "");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseURL,
    signedUrlTTL: normalizeSignedUrlTTL(process.env.MINIAPP_R2_SIGNED_URL_EXPIRES_SECONDS),
    host,
  };
}

export function isMiniAppMediaUploadConfigured(): boolean {
  return Boolean(parseConfig());
}

function inferExtension(fileName: string, contentType: string): string {
  const normalizedName = asTrimmedString(fileName).toLowerCase();
  const dot = normalizedName.lastIndexOf(".");
  if (dot >= 0 && dot < normalizedName.length - 1) {
    const ext = normalizedName.slice(dot + 1).replace(/[^a-z0-9]/g, "");
    if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  }

  const normalizedContentType = asTrimmedString(contentType).toLowerCase();
  if (normalizedContentType.endsWith("/png")) return "png";
  if (normalizedContentType.endsWith("/jpeg") || normalizedContentType.endsWith("/jpg")) return "jpg";
  if (normalizedContentType.endsWith("/webp")) return "webp";
  if (normalizedContentType.endsWith("/svg+xml") || normalizedContentType.endsWith("/svg")) return "svg";
  if (normalizedContentType.endsWith("/gif")) return "gif";
  if (normalizedContentType.endsWith("/avif")) return "avif";

  return "png";
}

function sanitizeVariant(variant: MiniAppMediaVariant | undefined): MiniAppMediaVariant | null {
  if (!variant) return null;
  const theme = asTrimmedString(variant.theme).toLowerCase();
  const density = asTrimmedString(variant.density).toLowerCase();
  const locale = asTrimmedString(variant.locale).toLowerCase();

  const out: MiniAppMediaVariant = {};
  if (theme === "light" || theme === "dark" || theme === "any") out.theme = theme;
  if (density === "1x" || density === "2x" || density === "3x") out.density = density;
  if (locale) out.locale = locale.replace(/[^a-z0-9-]/g, "");
  if (!out.theme && !out.density && !out.locale) return null;
  return out;
}

function buildKey(
  appId: string,
  assetType: MiniAppMediaAssetKind,
  extension: string,
  variant: MiniAppMediaVariant | undefined,
): string {
  const cleanAppId = appId.toLowerCase();
  const cleanType = assetType.toLowerCase();
  const sanitizedVariant = sanitizeVariant(variant);
  const variantSuffix = sanitizedVariant
    ? [sanitizedVariant.theme, sanitizedVariant.density, sanitizedVariant.locale].filter(Boolean).join(".")
    : "";
  const objectName = variantSuffix ? `${cleanType}.${variantSuffix}.${extension}` : `${cleanType}.${extension}`;
  return `miniapp-assets/${cleanAppId}/${objectName}`;
}

function resolvePublicURL(config: R2MediaConfig, key: string): string {
  if (config.publicBaseURL) {
    return `${config.publicBaseURL}/${key}`;
  }
  return `${config.endpoint}/${config.bucket}/${key}`;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeCanonicalUri(bucket: string, key: string): string {
  return `/${[bucket, ...key.split("/")].map((part) => encodeRfc3986(part)).join("/")}`;
}

function hashHex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function buildSigningKey(secretAccessKey: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, AWS_REGION);
  const kService = hmac(kRegion, AWS_SERVICE);
  return hmac(kService, "aws4_request");
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildCanonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function buildPresignedPutUrl(
  config: R2MediaConfig,
  key: string,
  contentType: string,
  cacheControl: string,
): string {
  const now = new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);
  const canonicalUri = encodeCanonicalUri(config.bucket, key);
  const signedHeaders = "cache-control;content-type;host";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": AWS_ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(config.signedUrlTTL),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  const canonicalHeaders = [
    `cache-control:${cacheControl}`,
    `content-type:${contentType}`,
    `host:${config.host}`,
  ].join("\n");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    buildCanonicalQuery(query),
    `${canonicalHeaders}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", buildSigningKey(config.secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const finalQuery = buildCanonicalQuery({
    ...query,
    "X-Amz-Signature": signature,
  });

  return `${config.endpoint}${canonicalUri}?${finalQuery}`;
}

export async function createMiniAppMediaUploadUrl(
  input: CreateMiniAppMediaUploadUrlInput,
): Promise<MiniAppMediaUploadUrlResult> {
  const config = parseConfig();
  if (!config) {
    throw new Error("createMiniAppMediaUploadUrl: Cloudflare R2 media upload is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY missing)");
  }

  const appId = asTrimmedString(input.app_id).toLowerCase();
  if (!APP_ID_REGEX.test(appId)) {
    throw new Error(`createMiniAppMediaUploadUrl: invalid app_id=\"${appId}\" does not match required pattern`);
  }

  const contentType = asTrimmedString(input.content_type).toLowerCase();
  if (!contentType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error(`createMiniAppMediaUploadUrl: content_type=\"${contentType}\" does not start with \"${IMAGE_MIME_PREFIX}\"`);
  }

  const extension = inferExtension(input.file_name || "", contentType);
  const key = buildKey(appId, input.asset_type, extension, input.variant);
  const cacheControl = "public, max-age=31536000, immutable";
  const uploadURL = buildPresignedPutUrl(config, key, contentType, cacheControl);

  return {
    upload_url: uploadURL,
    public_url: resolvePublicURL(config, key),
    key,
    expires_in: config.signedUrlTTL,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  };
}
