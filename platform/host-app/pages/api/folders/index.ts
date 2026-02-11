/**
 * Folders API
 * GET: List user's collection folders (paginated)
 * POST: Create a new folder
 */

import { createHandler } from "@/lib/api/create-handler";
import { paginationQuery, createFolderBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: {
      schema: paginationQuery,
      handler: async (req, res, ctx) => {
        const { limit, offset } = ctx.parsedInput as { limit: number; offset: number };
        const { data, count } = await ctx.db
          .from("collection_folders")
          .select("*", { count: "exact" })
          .eq("wallet_address", ctx.address!)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        return res.status(200).json({
          folders: data || [],
          total: count ?? 0,
          has_more: (count ?? 0) > offset + limit,
        });
      },
    },
    POST: {
      rateLimit: "write",
      schema: createFolderBody,
      handler: async (req, res, ctx) => {
        const { name, icon, color } = ctx.parsedInput as {
          name: string;
          icon?: string;
          color?: string;
        };
        const { data, error } = await ctx.db
          .from("collection_folders")
          .insert({ wallet_address: ctx.address!, name, icon, color })
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to create folder" });
        return res.status(201).json({ folder: data });
      },
    },
  },
});
