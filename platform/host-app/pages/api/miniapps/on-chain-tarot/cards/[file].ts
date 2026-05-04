import { promises as fs } from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

const SAFE_TAROT_CARD_FILE = /^(?:index\.json|back\.svg|\d{2}-[a-z0-9-]+\.svg)$/;

function getFileName(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  return path.basename(raw.trim());
}

function getCardsDir(): string {
  return path.resolve(process.cwd(), "..", "..", "apps", "on-chain-tarot", "public", "cards");
}

function getContentType(fileName: string): string {
  if (fileName.endsWith(".json")) return "application/json; charset=utf-8";
  if (fileName.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
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
