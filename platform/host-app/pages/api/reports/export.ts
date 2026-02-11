/**
 * Reports Export API
 * GET: List export jobs for authenticated wallet
 * POST: Create a new export job
 */

import { createHandler } from "@/lib/api/create-handler";
import { z } from "zod";

const createExportSchema = z.object({
  export_type: z.enum(["csv", "json", "pdf"]),
  filters: z.record(z.unknown()).optional(),
});

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: async (_req, res, ctx) => {
      const { data, error } = await ctx.db
        .from("export_jobs")
        .select("*")
        .eq("wallet_address", ctx.address!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) return res.status(500).json({ error: "Failed to fetch export jobs" });
      return res.status(200).json({ jobs: data || [] });
    },

    POST: {
      rateLimit: "write",
      schema: createExportSchema,
      handler: async (_req, res, ctx) => {
        const { export_type, filters } = ctx.parsedInput as z.infer<typeof createExportSchema>;

        const { data, error } = await ctx.db
          .from("export_jobs")
          .insert({
            wallet_address: ctx.address!,
            export_type,
            filters: filters || {},
          })
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to create export job" });
        return res.status(201).json({ job: data });
      },
    },
  },
});
