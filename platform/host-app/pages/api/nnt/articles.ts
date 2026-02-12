import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image?: string;
  url: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const articles = await fetchNNTArticles();
    return res.status(200).json({ articles });
  } catch (err) {
    logger.error("NNT fetch error", err);
    return res.status(500).json({ error: "Failed to fetch articles" });
  }
}

async function fetchNNTArticles(): Promise<Article[]> {
  const rssUrl = "https://neonewstoday.com/feed/";
  const response = await fetch(rssUrl);
  const xml = await response.text();
  const articles: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const desc = extractTag(item, "description");
    const image = extractMediaUrl(item);

    if (title && link) {
      articles.push({
        id: link.slice(-16),
        title: decodeHtmlEntities(title),
        excerpt: stripHtml(desc).slice(0, 200),
        date: pubDate || new Date().toISOString(),
        image,
        url: link,
      });
    }
    if (articles.length >= 10) break;
  }
  return articles;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || "").trim() : "";
}

function extractMediaUrl(xml: string): string | undefined {
  const match = xml.match(/<media:content[^>]*url="([^"]+)"/);
  if (match) return match[1];
  const enclosure = xml.match(/<enclosure[^>]*url="([^"]+)"/);
  return enclosure ? enclosure[1] : undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
