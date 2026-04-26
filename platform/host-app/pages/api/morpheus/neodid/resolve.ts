import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { resolveMorpheusDid } from "@/lib/morpheus-neodid";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.status(405).json({ error: "GET required" });
    return;
  }

  const did = String(req.query.did || "").trim();
  const format = String(req.query.format || "").trim();
  const network = String(req.query.network || "").trim();

  try {
    const result = await resolveMorpheusDid(did, {
      req,
      accept:
        typeof req.headers.accept === "string" ? req.headers.accept : null,
      format: format || null,
      network: network || null,
    });

    res.status(result.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", `${result.contentType}; charset=utf-8`);
    res.send(JSON.stringify(result.body, null, 2));
    return;
  } catch (error) {
    logger.error(
      "Failed to resolve Morpheus DID:",
      error instanceof Error ? error.message : String(error),
    );
    res.status(500).json({ error: "Failed to resolve DID" });
    return;
  }
}
