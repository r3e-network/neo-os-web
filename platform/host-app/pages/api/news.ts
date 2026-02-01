/**
 * API: Platform News
 * GET /api/news - Fetch latest platform news from database
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured", news: [] });
  }

  try {
    const { data, error } = await supabase
      .from("platform_news")
      .select("id, title, summary, category, created_at, link")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("News fetch error:", error);
      return res.json({ news: [] });
    }

    const news = (data || []).map((item) => ({
      id: String(item.id),
      title: item.title,
      summary: item.summary,
      category: item.category || "announcement",
      timestamp: item.created_at,
      link: item.link,
    }));

    return res.json({ news });
  } catch (error) {
    console.error("News API error:", error);
    return res.json({ news: [] });
  }
}
