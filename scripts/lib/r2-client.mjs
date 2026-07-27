/**
 * Minimal Cloudflare R2 client over the S3 API.
 *
 * Credentials are derived from a Cloudflare API token rather than a dedicated
 * pair of R2 access keys: the access key id is the token id, and the secret is
 * the sha256 of the token value. That keeps one rotatable credential instead of
 * two, and the same token already used for bucket administration works here.
 *
 * Only PUT is implemented, because publishing is the only thing the pipeline
 * needs; reads happen over the public custom domain.
 */
import crypto from "node:crypto";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".xml": "application/xml",
};

export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
export const POINTER_CACHE = "public, max-age=60, stale-while-revalidate=300";

export function contentTypeFor(key) {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function createR2Client({ accountId, apiToken, apiTokenId, bucket }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const secretAccessKey = crypto.createHash("sha256").update(apiToken, "utf8").digest("hex");

  async function put(key, body, cacheControl) {
    const contentType = contentTypeFor(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256hex(body);
    const canonicalUri = `/${[bucket, ...key.split("/")].map(encodeRfc3986).join("/")}`;

    const headers = {
      "cache-control": cacheControl,
      "content-type": contentType,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${String(headers[name]).trim()}\n`)
      .join("");
    const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
    const stringToSign = [AWS_ALGORITHM, amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n");
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), AWS_REGION), AWS_SERVICE),
      "aws4_request",
    );
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    // A full publish is ~2000 objects over tens of minutes, so a transient
    // connection reset is expected rather than exceptional. Retry those; a 4xx
    // is a real rejection and fails immediately. The signature is bound to
    // amzDate, so it stays valid across these retries.
    const request = () =>
      fetch(`https://${host}${canonicalUri}`, {
        method: "PUT",
        headers: {
          ...headers,
          Authorization: `${AWS_ALGORITHM} Credential=${apiTokenId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        },
        body,
      });

    const maxAttempts = 8;
    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await request();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`R2 PUT ${key} failed after ${maxAttempts} attempts: ${error.message}`);
        }
        await sleep(Math.min(250 * 2 ** (attempt - 1), 15_000));
        continue;
      }
      if (response.ok) break;
      // 5xx and 429 are worth another attempt; anything else is a decision.
      if (attempt === maxAttempts || (response.status < 500 && response.status !== 429)) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`R2 PUT ${key} failed: HTTP ${response.status} ${detail}`);
      }
      await sleep(Math.min(250 * 2 ** (attempt - 1), 15_000));
    }

    return { key, bytes: body.length, contentType, cacheControl };
  }

  return { put, host, bucket };
}
