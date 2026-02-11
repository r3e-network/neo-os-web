import { createHandler } from "@/lib/api/create-handler";
import { rollbackVersionBody } from "@/lib/schemas";
import type { z } from "zod";

export default createHandler({
  auth: "wallet",
  rateLimit: "write",
  methods: {
    POST: {
      schema: rollbackVersionBody,
      handler: async (req, res, ctx) => {
        const appId = req.query.appId as string;
        if (!appId) return res.status(400).json({ error: "Missing appId" });

        // Verify ownership
        const { data: app } = await ctx.db
          .from("miniapp_registry")
          .select("developer_address")
          .eq("app_id", appId)
          .single();

        if (!app || app.developer_address !== ctx.address) {
          return res.status(403).json({ error: "Not the app owner" });
        }

        const { to_version, reason } = ctx.parsedInput as z.infer<typeof rollbackVersionBody>;

        // Get current version
        const { data: current } = await ctx.db
          .from("app_versions")
          .select("version")
          .eq("app_id", appId)
          .eq("is_current", true)
          .single();

        if (!current) {
          return res.status(404).json({ error: "No current version found" });
        }

        // Verify target version exists
        const { data: target } = await ctx.db
          .from("app_versions")
          .select("version")
          .eq("app_id", appId)
          .eq("version", to_version)
          .single();

        if (!target) {
          return res.status(404).json({ error: "Target version not found" });
        }

        // Atomic version swap: clear ALL is_current flags first, then set target.
        const { error: clearError } = await ctx.db
          .from("app_versions")
          .update({ is_current: false })
          .eq("app_id", appId)
          .eq("is_current", true);

        if (clearError) {
          return res.status(500).json({ error: "Failed to rollback" });
        }

        const { error: setError } = await ctx.db
          .from("app_versions")
          .update({ is_current: true })
          .eq("app_id", appId)
          .eq("version", to_version);

        if (setError) {
          // Attempt to restore previous version on failure
          await ctx.db
            .from("app_versions")
            .update({ is_current: true })
            .eq("app_id", appId)
            .eq("version", current.version);
          return res.status(500).json({ error: "Failed to rollback" });
        }

        // Record rollback
        await ctx.db.from("version_rollbacks").insert({
          app_id: appId,
          from_version: current.version,
          to_version,
          reason,
          rolled_back_by: ctx.address,
        });

        return res.status(200).json({ success: true, from: current.version, to: to_version });
      },
    },
  },
});
