export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function withCors(headers: HeadersInit = {}): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    out.set(k, v);
  }
  return out;
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: withCors() });
}
