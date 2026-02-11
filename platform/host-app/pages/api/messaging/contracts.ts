/**
 * Messaging Contracts API
 * GET: Fetch data-sharing contracts for an app
 * POST: Create a new contract (ownership verified)
 * DELETE: Revoke a contract (ownership verified)
 */

import { createHandler } from "@/lib/api/create-handler";

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const { appId, role } = req.query;

      if (!appId || typeof appId !== "string") {
        return res.status(400).json({ error: "Missing appId" });
      }

      const column = role === "consumer" ? "consumer_app_id" : "provider_app_id";

      const { data, error } = await ctx.db
        .from("shared_data_contracts")
        .select("*")
        .eq(column, appId)
        .eq("status", "active");

      if (error) return res.status(500).json({ error: "Failed to fetch contracts" });
      return res.status(200).json({ contracts: data || [] });
    },

    POST: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        const { provider_app_id, consumer_app_id, data_schema, permissions } = req.body;

        if (!provider_app_id || !consumer_app_id || !data_schema) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Verify caller owns the provider app
        const { data: app } = await ctx.db
          .from("miniapp_registry")
          .select("developer_address")
          .eq("app_id", provider_app_id)
          .single();

        if (!app || app.developer_address !== ctx.address) {
          return res.status(403).json({ error: "Not the provider app owner" });
        }

        const { data, error } = await ctx.db
          .from("shared_data_contracts")
          .upsert(
            {
              provider_app_id,
              consumer_app_id,
              data_schema,
              permissions: permissions || { read: true, write: false },
              status: "active",
            },
            { onConflict: "provider_app_id,consumer_app_id" },
          )
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to create contract" });
        return res.status(201).json({ contract: data });
      },
    },

    DELETE: {
      rateLimit: "write",
      handler: async (req, res, ctx) => {
        const { contract_id } = req.body;

        if (!contract_id) {
          return res.status(400).json({ error: "Missing contract_id" });
        }

        // Look up contract to get provider_app_id
        const { data: contract } = await ctx.db
          .from("shared_data_contracts")
          .select("provider_app_id")
          .eq("contract_id", contract_id)
          .single();

        if (!contract) {
          return res.status(404).json({ error: "Contract not found" });
        }

        // Verify caller owns the provider app
        const { data: app } = await ctx.db
          .from("miniapp_registry")
          .select("developer_address")
          .eq("app_id", contract.provider_app_id)
          .single();

        if (!app || app.developer_address !== ctx.address) {
          return res.status(403).json({ error: "Not the contract owner" });
        }

        const { error } = await ctx.db
          .from("shared_data_contracts")
          .update({ status: "revoked" })
          .eq("contract_id", contract_id);

        if (error) return res.status(500).json({ error: "Failed to revoke contract" });
        return res.status(200).json({ success: true });
      },
    },
  },
});
