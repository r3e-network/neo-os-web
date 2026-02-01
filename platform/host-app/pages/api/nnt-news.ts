/**
 * API: Neo News Today Articles
 * GET /api/nnt-news - Fetch latest articles from Neo News Today RSS feed
 */
import type { NextApiRequest, NextApiResponse } from "next";

interface NNTArticle {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  imageUrl?: string;
  category?: string;
}

// Cache for RSS feed (5 minutes)
let cachedArticles: NNTArticle[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchNNTFeed(): Promise<NNTArticle[]> {
  const now = Date.now();
  if (cachedArticles.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
    return cachedArticles;
  }

  try {
    const response = await fetch("https://neonewstoday.com/feed/", {
      headers: {
        "User-Agent": "NeoHub/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      console.error("NNT RSS fetch failed:", response.status);
      return cachedArticles;
    }

    const xml = await response.text();
    const articles = parseRSSFeed(xml);

    cachedArticles = articles;
    cacheTimestamp = now;

    return articles;
  } catch (error) {
    console.error("NNT RSS fetch error:", error);
    return cachedArticles;
  }
}

function parseRSSFeed(xml: string): NNTArticle[] {
  const articles: NNTArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    const category = extractTag(itemXml, "category");
    let imageUrl = extractMediaContent(itemXml);
    if (!imageUrl) imageUrl = extractImageFromContent(itemXml);

    if (title && link) {
      articles.push({
        id: Buffer.from(link).toString("base64").slice(0, 16),
        title: decodeHTMLEntities(title),
        summary: cleanDescription(description),
        link,
        pubDate,
        imageUrl,
        category: category || "News",
      });
    }
  }

  return articles.slice(0, 20);
}

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractMediaContent(xml: string): string | undefined {
  const mediaMatch = xml.match(/<media:content[^>]*url="([^"]+)"/i);
  if (mediaMatch) return mediaMatch[1];
  const enclosureMatch = xml.match(/<enclosure[^>]*url="([^"]+)"/i);
  if (enclosureMatch) return enclosureMatch[1];
  return undefined;
}

function extractImageFromContent(xml: string): string | undefined {
  const contentMatch = xml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
  if (contentMatch) {
    const imgMatch = contentMatch[1].match(/<img[^>]*src="([^"]+)"/i);
    if (imgMatch) return imgMatch[1];
  }
  return undefined;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

function cleanDescription(desc: string): string {
  if (!desc) return "";
  return decodeHTMLEntities(desc.replace(/<[^>]+>/g, "")).slice(0, 200);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const articles = await fetchNNTFeed();

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json({
      articles: articles.slice(0, limit),
      source: "Neo News Today",
      sourceUrl: "https://neonewstoday.com",
    });
  } catch (error) {
    console.error("NNT News API error:", error);
    return res.status(500).json({ error: "Failed to fetch news", articles: [] });
  }
}
