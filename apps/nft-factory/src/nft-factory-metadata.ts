const MAX_METADATA_BYTES = 256 * 1024;
const METADATA_TIMEOUT_MS = 8_000;

export type NftMetadataVerificationStatus =
  | "not-checked"
  | "checking"
  | "verified"
  | "invalid"
  | "unavailable";

export interface NftMetadataVerification {
  status: Exclude<NftMetadataVerificationStatus, "checking">;
  sampleUrl: string;
  checkedAt: number;
  name?: string;
  image?: string;
  detailKey:
    | "metadataNotChecked"
    | "metadataVerified"
    | "metadataBaseUriInvalid"
    | "metadataSampleUnavailable"
    | "metadataSampleInvalid";
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<
  Pick<Response, "ok" | "status" | "headers" | "text"> &
    Partial<Pick<Response, "url">>
>;

function unavailable(
  sampleUrl: string,
  detailKey: NftMetadataVerification["detailKey"],
  status: "invalid" | "unavailable",
): NftMetadataVerification {
  return { status, sampleUrl, checkedAt: Date.now(), detailKey };
}

function validAssetReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
    return false;
  }
  if (value.trim() !== value || /[\u0000-\u0020\u007f]/.test(value)) return false;
  if (/^(ipfs|ar):\/\/[^/?#]+(?:[/?#].*)?$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Verify token #1 at the creator-supplied metadata origin.
 *
 * This is deliberately a read-only availability/schema check. NFT Factory
 * does not upload, pin, mirror, or promise immutability for the remote JSON or
 * artwork; the package commits only to the base URI.
 */
export async function verifyNftMetadataOrigin(
  baseUriValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<NftMetadataVerification> {
  const baseUri = String(baseUriValue ?? "").trim();
  let base: URL;
  try {
    base = new URL(baseUri);
  } catch {
    return unavailable("", "metadataBaseUriInvalid", "invalid");
  }
  if (
    base.protocol !== "https:" ||
    !baseUri.endsWith("/") ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    return unavailable("", "metadataBaseUriInvalid", "invalid");
  }

  const sampleUrl = new URL("1", base).href;
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetcher(sampleUrl, {
      method: "GET",
      headers: { accept: "application/json, application/*+json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      return unavailable(sampleUrl, "metadataSampleUnavailable", "unavailable");
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (
        finalUrl.protocol !== "https:" ||
        finalUrl.username ||
        finalUrl.password
      ) {
        return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
      }
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_METADATA_BYTES) {
      return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("+json")) {
      return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
    }
    const body = await response.text();
    if (!body || new TextEncoder().encode(body).byteLength > MAX_METADATA_BYTES) {
      return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
    }
    let metadata: Record<string, unknown>;
    try {
      const parsed = JSON.parse(body) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
      }
      metadata = parsed as Record<string, unknown>;
    } catch {
      return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
    }
    const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
    const image = metadata.image;
    if (
      !name ||
      name.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(name) ||
      !validAssetReference(image)
    ) {
      return unavailable(sampleUrl, "metadataSampleInvalid", "invalid");
    }
    return {
      status: "verified",
      sampleUrl,
      checkedAt: Date.now(),
      detailKey: "metadataVerified",
      name,
      image,
    };
  } catch {
    return unavailable(sampleUrl, "metadataSampleUnavailable", "unavailable");
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export function createUncheckedMetadataVerification(): NftMetadataVerification {
  return {
    status: "not-checked",
    sampleUrl: "",
    checkedAt: 0,
    detailKey: "metadataNotChecked",
  };
}
