import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
};

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE_MIME_PREFIX = "image/";
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "svg", "gif", "avif"]);

let cachedClient: S3Client | null = null;
let cachedClientKey = "";

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

  const publicBaseURL = asTrimmedString(process.env.MINIAPP_MEDIA_PUBLIC_BASE_URL || "https://meshmini.app").replace(/\/+$/, "");
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseURL,
    signedUrlTTL: normalizeSignedUrlTTL(process.env.MINIAPP_R2_SIGNED_URL_EXPIRES_SECONDS),
  };
}

export function isMiniAppMediaUploadConfigured(): boolean {
  return Boolean(parseConfig());
}

function getClient(config: R2MediaConfig): S3Client {
  const key = `${config.accountId}:${config.accessKeyId}:${config.bucket}:${config.endpoint}`;
  if (cachedClient && cachedClientKey === key) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedClientKey = key;
  return cachedClient;
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

export async function createMiniAppMediaUploadUrl(
  input: CreateMiniAppMediaUploadUrlInput,
): Promise<MiniAppMediaUploadUrlResult> {
  const config = parseConfig();
  if (!config) {
    throw new Error("Cloudflare R2 media upload is not configured");
  }

  const appId = asTrimmedString(input.app_id).toLowerCase();
  if (!APP_ID_REGEX.test(appId)) {
    throw new Error("Invalid app_id format");
  }

  const contentType = asTrimmedString(input.content_type).toLowerCase();
  if (!contentType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error("Only image uploads are supported");
  }

  const extension = inferExtension(input.file_name || "", contentType);
  const key = buildKey(appId, input.asset_type, extension, input.variant);
  const cacheControl = "public, max-age=31536000, immutable";

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  const uploadURL = await getSignedUrl(getClient(config), command, {
    expiresIn: config.signedUrlTTL,
  });

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
