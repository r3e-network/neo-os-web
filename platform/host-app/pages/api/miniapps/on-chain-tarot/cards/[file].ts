import { promises as fs } from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

import { findMiniAppCdnApp, isMiniAppCdnEnabled } from "@/lib/miniapp-cdn";

const SAFE_TAROT_CARD_FILE = /^(?:index\.json|back\.webp|\d{2}-[a-z0-9-]+\.webp)$/;

function getFileName(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  return path.basename(raw.trim());
}

const TAROT_SLUG = "on-chain-tarot";

/**
 * Only reachable when the host serves bundles itself (offline development, the
 * E2E suite). Otherwise the cards live inside the published bundle.
 */
function getCardsDir(): string {
  return path.resolve(process.cwd(), "..", "..", "apps", TAROT_SLUG, "public", "cards");
}

function getContentType(fileName: string): string {
  if (fileName.endsWith(".json")) return "application/json; charset=utf-8";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "method not allowed" } });
    return;
  }

  const fileName = getFileName(req.query.file);
  if (!SAFE_TAROT_CARD_FILE.test(fileName)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Tarot card asset not found" } });
    return;
  }

  // Card assets ship inside the app's own bundle, and the app asks for them
  // relatively ("./cards/back.webp"), so it never reaches this route. The route
  // stays for the absolute /miniapps/on-chain-tarot/cards/* URLs that were valid
  // while the platform served the bundle from its own public directory - cached
  // clients and printed QR codes still use them. Reading from disk is now the
  // fallback, not the path: the app sources live in neo-minigames.
  if (isMiniAppCdnEnabled()) {
    const app = await findMiniAppCdnApp(TAROT_SLUG);
    if (app) {
      const base = app.entry_url.replace(/\/index\.html$/, "");
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.redirect(302, `${base}/cards/${fileName}`);
      return;
    }
    // A CDN blip should degrade to a locally staged bundle, not a broken card.
  }

  const cardsDir = getCardsDir();
  const filePath = path.join(cardsDir, fileName);
  if (!filePath.startsWith(`${cardsDir}${path.sep}`)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Tarot card asset not found" } });
    return;
  }

  try {
    const payload = await fs.readFile(filePath);
    res.setHeader("Content-Type", getContentType(fileName));
    res.setHeader("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).send(payload);
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOENT") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Tarot card asset not found" } });
      return;
    }
    res.status(500).json({ error: { code: "READ_FAILED", message: "Failed to read tarot card asset" } });
  }
}
