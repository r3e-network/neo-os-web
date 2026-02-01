// =============================================================================
// CDN Upload Service
// Supports multiple CDN providers: R2, S3, Cloudflare R2
// =============================================================================

import { mustGetEnv } from "../env.ts";

export type CDNProvider = "r2" | "s3" | "cloudflare" | "vercel";

// Directory entry type for Deno.readDirSync
interface DirEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
}

// Deno global is available in Supabase Edge Functions
declare const Deno: {
  readDirSync(path: string): Iterable<DirEntry>;
  readFile(path: string): Promise<Uint8Array>;
};

/**
 * Get the configured CDN provider
 */
export function getCDNProvider(): CDNProvider {
  const provider = mustGetEnv("CDN_PROVIDER") || "r2";
  return provider as CDNProvider;
}

/**
 * Upload a file to CDN
 */
export async function uploadFile(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<{ url: string; key: string }> {
  const provider = getCDNProvider();

  switch (provider) {
    case "r2":
      return uploadToR2(key, body, contentType);
    case "s3":
      return uploadToS3(key, body, contentType);
    case "cloudflare":
      return uploadToCloudflare(key, body, contentType);
    case "vercel":
      return uploadToVercel(key, body, contentType);
    default:
      throw new Error(`Unsupported CDN provider: ${provider}`);
  }
}

/**
 * Upload to Cloudflare R2
 */
async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<{ url: string; key: string }> {
  const accountId = mustGetEnv("R2_ACCOUNT_ID");
  const bucket = mustGetEnv("R2_BUCKET");
  const cdnBaseUrl = mustGetEnv("CDN_BASE_URL");

  // Use R2-compatible S3 API
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const accessKeyId = mustGetEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = mustGetEnv("R2_SECRET_ACCESS_KEY");

  // Simple HMAC-SHA256 signature
  const canonicalRequest = `${key}`;
  const stringToSign = `${date}\n${canonicalRequest}`;
  const signature = await hmacSha256(secretAccessKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/auto/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Authorization: authorization,
      Host: `${accountId}.r2.cloudflarestorage.com`,
      "x-amz-date": date,
    },
    body: new Blob([new Uint8Array(body)], { type: contentType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
  }

  return { url: `${cdnBaseUrl}/${key}`, key };
}

/**
 * Upload to AWS S3
 */
async function uploadToS3(key: string, body: Uint8Array, contentType: string): Promise<{ url: string; key: string }> {
  const region = mustGetEnv("AWS_REGION") || "us-east-1";
  const bucket = mustGetEnv("S3_BUCKET");
  const cdnBaseUrl = mustGetEnv("CDN_BASE_URL");

  const url = `https://s3.${region}.amazonaws.com/${bucket}/${key}`;

  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const accessKeyId = mustGetEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = mustGetEnv("AWS_SECRET_ACCESS_KEY");

  const canonicalRequest = `${key}`;
  const stringToSign = `${date}\n${canonicalRequest}`;
  const signature = await hmacSha256(secretAccessKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/auto/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Authorization: authorization,
      Host: `s3.${region}.amazonaws.com`,
      "x-amz-date": date,
    },
    body: new Blob([new Uint8Array(body)], { type: contentType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S3 upload failed: ${response.status} ${errorText}`);
  }

  return { url: `${cdnBaseUrl}/${key}`, key };
}

/**
 * Upload to Cloudflare (simplified - uses R2 for non-images)
 */
async function uploadToCloudflare(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<{ url: string; key: string }> {
  const isImage = contentType.startsWith("image/");

  if (isImage) {
    // Use Cloudflare Images API for images
    const accountId = mustGetEnv("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = mustGetEnv("CLOUDFLARE_API_TOKEN");

    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(body)], { type: contentType }), key);
    formData.append("requireSignedURLs", "false");

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare Images upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return { url: result.variants[0], key };
  } else {
    // Use R2 for other files
    return uploadToR2(key, body, contentType);
  }
}

/**
 * Upload to Vercel Blob Storage
 */
async function uploadToVercel(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<{ url: string; key: string }> {
  const blobToken = mustGetEnv("VERCEL_BLOB_TOKEN");
  const blobStoreId = mustGetEnv("VERCEL_BLOB_STORE_ID");
  const cdnBaseUrl = mustGetEnv("CDN_BASE_URL");

  // Vercel Blob API endpoint
  const url = `https://blob.vercel-storage.com/${blobStoreId}`;

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(body)], { type: contentType }), key);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${blobToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vercel Blob upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  // Vercel Blob returns the URL in the result
  return { url: result.url || `${cdnBaseUrl}/${key}`, key };
}

/**
 * Upload directory recursively to CDN
 */
export async function uploadDirectory(
  dirPath: string,
  baseKey: string,
  ignorePaths: string[] = ["node_modules", ".git"]
): Promise<{ uploaded: number; failed: number; urls: string[] }> {
  const uploaded: string[] = [];
  let failed = 0;

  const entries = Array.from(Deno.readDirSync(dirPath)) as DirEntry[];

  for (const entry of entries) {
    if (entry.isDirectory) {
      if (ignorePaths.includes(entry.name)) {
        continue;
      }
      const subPath = `${dirPath}/${entry.name}`;
      const subResult = await uploadDirectory(subPath, `${baseKey}/${entry.name}`, ignorePaths);
      uploaded.push(...subResult.urls);
      failed += subResult.failed;
    } else {
      const filePath = `${dirPath}/${entry.name}`;
      const key = `${baseKey}/${entry.name}`;
      const contentType = getContentType(filePath);

      try {
        const fileData = await Deno.readFile(filePath);
        const result = await uploadFile(key, fileData, contentType);
        uploaded.push(result.url);
      } catch (error) {
        console.error(`Failed to upload ${filePath}:`, error);
        failed++;
      }
    }
  }

  return { uploaded: uploaded.length, failed, urls: uploaded };
}

/**
 * Get content type for file
 */
function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    wasm: "application/wasm",
  };
  return types[ext || ""] || "application/octet-stream";
}

/**
 * HMAC SHA-256
 */
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
