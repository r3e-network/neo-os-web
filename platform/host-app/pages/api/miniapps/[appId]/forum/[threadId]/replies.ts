/**
 * Forum Replies API
 * GET: List replies for a thread
 * POST: Create a new reply (requires wallet auth)
 */

import { createHandler } from "@/lib/api";
import type { NextApiRequest, NextApiResponse } from "next";
import type { HandlerContext } from "@/lib/api/types";
import { logger } from "@/lib/logger";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: {
      rateLimit: "api",
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { threadId } = req.query;
        if (!threadId || typeof threadId !== "string") {
          return res.status(400).json({ error: "Missing threadId" });
        }

        const { data, error } = await ctx.db
          .from("forum_replies")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true });

        if (error) {
          logger.error("[Forum] replies list error", error);
          return res.status(500).json({ error: "Failed to fetch replies" });
        }

        return res.status(200).json({ replies: data ?? [] });
      },
    },
    POST: {
      rateLimit: "write",
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { threadId } = req.query;
        if (!threadId || typeof threadId !== "string") {
          return res.status(400).json({ error: "Missing threadId" });
        }

        const { content } = req.body;
        if (!content?.trim()) {
          return res.status(400).json({ error: "Missing fields" });
        }

        const address = ctx.address!;

        const { data, error } = await ctx.db
          .from("forum_replies")
          .insert({
            thread_id: threadId,
            author_id: address,
            author_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            content: content.trim().slice(0, 2000),
            is_solution: false,
            upvotes: 0,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          logger.error("[Forum] reply create error", error);
          return res.status(500).json({ error: "Failed to create reply" });
        }

        // Update thread's last_reply_at and reply_count
        const { error: rpcErr } = await ctx.db.rpc("increment_thread_reply_count", {
          p_thread_id: threadId,
        });
        if (rpcErr) {
          // Fallback: manual SQL increment if RPC doesn't exist
          const { data: thread } = await ctx.db.from("forum_threads").select("reply_count").eq("id", threadId).single();
          await ctx.db
            .from("forum_threads")
            .update({
              last_reply_at: new Date().toISOString(),
              reply_count: (thread?.reply_count ?? 0) + 1,
            })
            .eq("id", threadId);
        }

        return res.status(201).json({ reply: data });
      },
    },
  },
});
