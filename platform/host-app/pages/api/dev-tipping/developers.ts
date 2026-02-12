/**
 * Dev Tipping — Developers API
 * GET: List developers with tip stats (public, cached)
 * POST: Record a tip (wallet auth required)
 */

import { createHandler } from "@/lib/api/create-handler";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { logger } from "@/lib/logger";

interface Developer {
  id: number;
  name: string;
  role: string;
  wallet: string;
  total_tips: number;
  tip_count: number;
}

// Simple in-memory cache
let cachedDevelopers: Developer[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export default createHandler({
  auth: "none",
  rateLimit: "api",
  methods: {
    GET: async (_req, res, ctx) => {
      if (cachedDevelopers && Date.now() - lastCacheTime < CACHE_TTL) {
        return res.status(200).json({ developers: cachedDevelopers });
      }

      const { data, error } = await ctx.db
        .from("dev_tipping_developers")
        .select("*")
        .order("total_tips", { ascending: false });

      if (error) {
        logger.error("[dev-tipping] Failed to fetch developers", error);
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

      cachedDevelopers = developers;
      lastCacheTime = Date.now();

      return res.status(200).json({ developers });
    },

    POST: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        // Manual wallet auth for POST only (GET is public)
        const auth = requireWalletAuth(req.headers);
        if (!auth.ok) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const { tipper_name, developer_id, amount, message, tx_hash } = req.body;
        if (!developer_id || !amount) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const { error: tipError } = await ctx.db.from("dev_tipping_tips").insert({
          tipper_address: auth.address,
          tipper_name: tipper_name || "Anonymous",
          developer_id,
          amount,
          message: message || "",
          tx_hash: tx_hash || null,
        });

        if (tipError) {
          logger.error("[dev-tipping] Failed to record tip", tipError);
          return res.status(500).json({ error: "Failed to record tip" });
        }

        // Update developer stats
        const { error: updateError } = await ctx.db.rpc("increment_developer_tips", {
          dev_id: developer_id,
          tip_amount: amount,
        });

        if (updateError) {
          logger.warn("[dev-tipping] Failed to update developer stats");
        }

        // Invalidate cache
        cachedDevelopers = null;

        return res.status(201).json({ success: true });
      },
    },
  },
});
