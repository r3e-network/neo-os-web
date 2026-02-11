/**
 * Developer Preferences API (Follow/Unfollow)
 * GET: List followed developers (paginated)
 * POST: Follow a developer
 * DELETE: Unfollow a developer
 */

import { createHandler } from "@/lib/api/create-handler";
import { paginationQuery } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: {
      schema: paginationQuery,
      handler: async (req, res, ctx) => {
        const { limit, offset } = ctx.parsedInput as { limit: number; offset: number };

        const { data, error, count } = await ctx.db
          .from("followed_developers")
          .select("developer_address, created_at", { count: "exact" })
          .eq("wallet_address", ctx.address!)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          return res.status(500).json({ error: "Failed to fetch followed developers" });
        }

        return res.status(200).json({
          developers: data || [],
          total: count ?? 0,
          has_more: (count ?? 0) > offset + limit,
        });
      },
    },

    POST: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        const { developer_address } = req.body;
        if (!developer_address) {
          return res.status(400).json({ error: "Missing developer_address" });
        }

        const { error } = await ctx.db.from("followed_developers").insert({
          wallet_address: ctx.address!,
          developer_address,
        });

        if (error?.code === "23505") {
          return res.status(409).json({ error: "Already following" });
        }
        if (error) {
          return res.status(500).json({ error: "Failed to follow developer" });
        }

        return res.status(201).json({ success: true });
      },
    },

    DELETE: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        const { developer_address } = req.body;
        if (!developer_address) {
          return res.status(400).json({ error: "Missing developer_address" });
        }

        const { error } = await ctx.db
          .from("followed_developers")
          .delete()
          .eq("wallet_address", ctx.address!)
          .eq("developer_address", developer_address);

        if (error) {
          return res.status(500).json({ error: "Failed to unfollow developer" });
        }

        return res.status(200).json({ success: true });
      },
    },
  },
});
