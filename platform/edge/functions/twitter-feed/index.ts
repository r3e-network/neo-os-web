import { handleCorsPreflight } from "../_shared/cors.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { json } from "../_shared/response.ts";
import { getEnv } from "../_shared/env.ts";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author: string;
  url: string;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "method not allowed" } }, { status: 405 }, req);

  const rl = await requireRateLimit(req, "twitter-feed");
  if (rl) return rl;

  const bearerToken = getEnv("TWITTER_BEARER_TOKEN");

  // If no token, return empty data
  if (!bearerToken) {
    return json({ tweets: [] }, {}, req);
  }

  try {
    // Neo official Twitter user ID
    const userId = "2231777543"; // @Neo_Blockchain
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return json({ tweets: [] }, {}, req);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.error("[twitter-feed] invalid JSON response from Twitter API");
      return json({ tweets: [] }, {}, req);
    }
    const payload = data && typeof data === "object" ? data as { data?: unknown } : {};
    const tweetRows = Array.isArray(payload.data) ? payload.data : [];
    const tweets: Tweet[] = tweetRows.map((t: unknown) => {
      const row = t && typeof t === "object" ? t as Record<string, unknown> : {};
      const id = String(row.id ?? "");
      return {
      id,
      text: String(row.text ?? ""),
      created_at: String(row.created_at ?? ""),
      author: "Neo Smart Economy",
      url: `https://twitter.com/Neo_Blockchain/status/${id}`,
    };
    });

    return json({ tweets }, {}, req);
  } catch (err) {
    console.error("[twitter-feed] fetch error:", err instanceof Error ? err.message : String(err));
    return json({ tweets: [] }, {}, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
