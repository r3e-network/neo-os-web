import { handleCorsPreflight } from "../_shared/cors.ts";
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

  const bearerToken = getEnv("TWITTER_BEARER_TOKEN");

  // If no token, return mock data
  if (!bearerToken) {
    return json({ tweets: getMockTweets() }, {}, req);
  }

  try {
    // Neo official Twitter user ID
    const userId = "2231777543"; // @Neo_Blockchain
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      return json({ tweets: getMockTweets() }, {}, req);
    }

    const data = await res.json();
    const tweets: Tweet[] = (data.data || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      author: "Neo Smart Economy",
      url: `https://twitter.com/Neo_Blockchain/status/${t.id}`,
    }));

    return json({ tweets }, {}, req);
  } catch {
    return json({ tweets: getMockTweets() }, {}, req);
  }
}

function getMockTweets(): Tweet[] {
  return [
    {
      id: "1",
      text: "🚀 Neo N3 continues to grow! Over 1M transactions processed this month.",
      created_at: new Date().toISOString(),
      author: "Neo Smart Economy",
      url: "https://twitter.com/Neo_Blockchain",
    },
    {
      id: "2",
      text: "📢 New MiniApp SDK released! Build decentralized apps faster than ever.",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      author: "Neo Smart Economy",
      url: "https://twitter.com/Neo_Blockchain",
    },
  ];
}

if (import.meta.main) {
  Deno.serve(handler);
}
