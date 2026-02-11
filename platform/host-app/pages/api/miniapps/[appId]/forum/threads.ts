/**
 * Forum Threads API
 * GET: List threads for a miniapp (with category filter, pagination)
 * POST: Create a new thread (requires wallet auth)
 */

import { createHandler } from "@/lib/api";
import type { NextApiRequest, NextApiResponse } from "next";
import type { HandlerContext } from "@/lib/api/types";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: {
      rateLimit: "api",
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { appId } = req.query;
        if (!appId || typeof appId !== "string") {
          return res.status(400).json({ error: "Missing appId" });
        }

        const category = req.query.category as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const offset = parseInt(req.query.offset as string) || 0;

        let query = ctx.db.from("forum_threads").select("*", { count: "exact" }).eq("app_id", appId);

        if (category) {
          query = query.eq("category", category);
        }

        // Pinned first, then by last activity
        query = query
          .order("is_pinned", { ascending: false })
          .order("last_reply_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
          console.error("[Forum] threads list error:", error);
          return res.status(500).json({ error: "Failed to fetch threads" });
        }

        const total = count ?? 0;
        return res.status(200).json({
          threads: data ?? [],
          hasMore: offset + limit < total,
          total,
        });
      },
    },
    POST: {
      rateLimit: "write",
      handler: async (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => {
        const { appId } = req.query;
        if (!appId || typeof appId !== "string") {
          return res.status(400).json({ error: "Missing appId" });
        }

        const { title, content, category } = req.body;
        if (!title?.trim() || !content?.trim()) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const address = ctx.address!;
        const now = new Date().toISOString();

        const { data, error } = await ctx.db
          .from("forum_threads")
          .insert({
            app_id: appId,
            author_id: address,
            author_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            title: title.trim().slice(0, 200),
            content: content.trim().slice(0, 5000),
            category: category || "general",
            reply_count: 0,
            view_count: 0,
            is_pinned: false,
            is_locked: false,
            created_at: now,
            updated_at: now,
            last_reply_at: null,
          })
          .select()
          .single();

        if (error) {
          console.error("[Forum] thread create error:", error);
          return res.status(500).json({ error: "Failed to create thread" });
        }

        return res.status(201).json({ thread: data });
      },
    },
  },
});
