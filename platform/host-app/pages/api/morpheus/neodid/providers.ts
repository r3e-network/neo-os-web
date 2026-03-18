import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { fetchNeoDidProviders } from "@/lib/morpheus-neodid";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.status(405).json({ error: "GET required" });
    return;
  }

  const network = String(req.query.network || "").trim().toLowerCase() === "testnet" ? "testnet" : "mainnet";
  const payload = await fetchNeoDidProviders(network);

  res.status(200).json(payload);
}
