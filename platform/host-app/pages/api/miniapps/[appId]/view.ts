/**
 * Track MiniApp View Count (Multi-Chain Support)
 * POST: Increment view count for a miniapp on a specific chain
 * GET: Get current view count
 *
 * Query params:
 * - chain_id: Optional chain identifier (defaults to 'neo-n3-mainnet')
 */

import { createHandler } from "@/lib/api";
import type { NextApiRequest, NextApiResponse } from "next";
import type { HandlerContext } from "@/lib/api/types";

const DEFAULT_CHAIN_ID = "neo-n3-mainnet";

function resolveParams(req: NextApiRequest) {
  const { appId, chain_id } = req.query;
  const chainId = typeof chain_id === "string" ? chain_id : DEFAULT_CHAIN_ID;
  return { appId: typeof appId === "string" ? appId : "", chainId };
}

export default createHandler({
  auth: "none",
  rateLimit: "api",
  methods: {
    GET: {
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { appId, chainId } = resolveParams(req);
        if (!appId) return res.status(400).json({ error: "appId is required" });

        const { data, error } = await ctx.db
          .from("miniapp_stats_summary")
          .select("view_count")
          .eq("app_id", appId)
          .eq("chain_id", chainId)
          .single();

        if (error) {
          return res.status(200).json({ view_count: 0, chain_id: chainId });
        }
        return res.status(200).json({ view_count: data?.view_count || 0, chain_id: chainId });
      },
    },
    POST: {
      rateLimit: "write",
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { appId, chainId } = resolveParams(req);
        if (!appId) return res.status(400).json({ error: "appId is required" });

        // Try RPC first
        const { data, error } = await ctx.db.rpc("increment_miniapp_view_count", {
          p_app_id: appId,
          p_chain_id: chainId,
        });

        if (!error) {
          return res.status(200).json({ view_count: data, chain_id: chainId });
        }

        // Fallback: manual upsert
        const { data: current } = await ctx.db
          .from("miniapp_stats_summary")
          .select("view_count, total_unique_users, total_transactions")
          .eq("app_id", appId)
          .eq("chain_id", chainId)
          .single();

        const newCount = (current?.view_count || 0) + 1;

        await ctx.db.from("miniapp_stats_summary").upsert(
          {
            app_id: appId,
            chain_id: chainId,
            view_count: newCount,
            total_unique_users: current?.total_unique_users || 0,
            total_transactions: current?.total_transactions || 0,
          },
          { onConflict: "app_id,chain_id" },
        );

        return res.status(200).json({ view_count: newCount, chain_id: chainId });
      },
    },
  },
});
