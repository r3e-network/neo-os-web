import type { NextApiRequest, NextApiResponse } from "next";

function getEdgeFunctionsBaseUrl(): string {
  const raw = String(process.env.EDGE_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!raw) return "";
  const base = raw.replace(/\/$/, "");
  if (base.endsWith("/functions/v1")) return base;
  return `${base}/functions/v1`;
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fn = String(req.query.fn ?? "").trim();
  if (!fn) {
    res.status(400).json({ error: "function name required" });
    return;
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    res.status(500).json({ error: "EDGE_BASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not configured" });
    return;
  }

  const url = new URL(`${base}/${encodeURIComponent(fn)}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "fn") continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    if (k === "host" || k === "connection" || k === "content-length") continue;
    if (Array.isArray(v)) headers.set(k, v.join(","));
    else headers.set(k, v);
  }

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  // Buffer is a Uint8Array at runtime, but DOM fetch typings don't accept Buffer.
  const body = rawBody ? new Uint8Array(rawBody) : undefined;

  const upstream = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (key === "transfer-encoding" || key === "connection") return;
    res.setHeader(key, value);
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

export const config = {
  api: { bodyParser: false },
};
