import { NextApiRequest, NextApiResponse } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  if (!path || !Array.isArray(path)) {
    return res.status(400).json({ error: "Invalid path" });
  }

  const filePath = join(process.cwd(), "public", "miniapp-assets", ...path);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const fileContent = readFileSync(filePath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(fileContent);
  } catch {
    res.status(500).json({ error: "Failed to read file" });
  }
}
