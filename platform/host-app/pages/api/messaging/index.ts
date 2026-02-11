/**
 * Messaging API
 * GET: Fetch messages for an app (ownership verified)
 * POST: Send a message from one app to another (ownership verified)
 */

import { createHandler } from "@/lib/api/create-handler";

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const { appId, status } = req.query;

      if (!appId || typeof appId !== "string") {
        return res.status(400).json({ error: "Missing appId" });
      }

      // Verify caller owns the target app
      const { data: app } = await ctx.db
        .from("miniapp_registry")
        .select("developer_address")
        .eq("app_id", appId)
        .single();

      if (!app || app.developer_address !== ctx.address) {
        return res.status(403).json({ error: "Not the app owner" });
      }

      let query = ctx.db
        .from("app_messages")
        .select("*")
        .eq("target_app_id", appId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (status && typeof status === "string") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: "Failed to fetch messages" });
      return res.status(200).json({ messages: data || [] });
    },

    POST: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        const { source_app_id, target_app_id, message_type, payload } = req.body;

        if (!source_app_id || !target_app_id || !message_type) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Verify caller owns the source app
        const { data: app } = await ctx.db
          .from("miniapp_registry")
          .select("developer_address")
          .eq("app_id", source_app_id)
          .single();

        if (!app || app.developer_address !== ctx.address) {
          return res.status(403).json({ error: "Not the source app owner" });
        }

        const { data, error } = await ctx.db
          .from("app_messages")
          .insert({
            source_app_id,
            target_app_id,
            message_type,
            payload: payload || {},
          })
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to send message" });
        return res.status(201).json({ message: data });
      },
    },
  },
});
