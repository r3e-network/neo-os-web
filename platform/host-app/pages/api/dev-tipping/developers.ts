import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Developer {
  id: number;
  name: string;
  role: string;
  wallet: string;
  total_tips: number;
  tip_count: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getDevelopers(res);
  }

  if (req.method === "POST") {
    return recordTip(req, res);
  }


  return res.status(405).json({ error: "Method not allowed" });

}

// Simple in-memory cache
let cachedDevelopers: Developer[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

function getCachedDevelopers(): Developer[] | null {
  if (cachedDevelopers && Date.now() - lastCacheTime < CACHE_TTL) {
    return cachedDevelopers;
  }
  return null;
}

async function getDevelopers(res: NextApiResponse) {
  const cached = getCachedDevelopers();
  if (cached) {
    return res.status(200).json({ developers: cached });
  }

  const { data, error } = await supabase
    .from("dev_tipping_developers")
    .select("*")
    .order("total_tips", { ascending: false });

  if (error) {
    console.error("[dev-tipping] Failed to fetch developers:", error);
    return res.status(500).json({ error: "Failed to fetch developers" });
  }

  const developers: Developer[] = (data || []).map((dev, index) => ({
    id: dev.id,
    name: dev.name || `Developer #${dev.id}`,
    role: dev.role || "Neo Developer",
    wallet: dev.wallet_address,
    total_tips: dev.total_tips || 0,
    tip_count: dev.tip_count || 0,
    rank: `#${index + 1}`,
  }));

  // Update Cache
  cachedDevelopers = developers;
  lastCacheTime = Date.now();

  return res.status(200).json({ developers });
}

async function recordTip(req: NextApiRequest, res: NextApiResponse) {
  const { tipper_address, tipper_name, developer_id, amount, message, tx_hash } = req.body;

  if (!tipper_address || !developer_id || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Insert tip record
  const { error: tipError } = await supabase.from("dev_tipping_tips").insert({
    tipper_address,
    tipper_name: tipper_name || "Anonymous",
    developer_id,
    amount,
    message: message || "",
    tx_hash: tx_hash || null,
  });

  if (tipError) {
    console.error("[dev-tipping] Failed to record tip:", tipError);
    return res.status(500).json({ error: "Failed to record tip" });
  }

  // Update developer stats
  const { error: updateError } = await supabase.rpc("increment_developer_tips", {
    dev_id: developer_id,
    tip_amount: amount,
  });

  if (updateError) {
    console.warn("[dev-tipping] Failed to update developer stats:", updateError);
  }

  // Invalidate cache
  cachedDevelopers = null;

  return res.status(201).json({ success: true });
}
