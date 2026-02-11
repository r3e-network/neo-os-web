/**
 * App Versions API - List and Create Versions
 */

import { createHandler } from "@/lib/api/create-handler";
import { createVersionBody } from "@/lib/schemas";
import type { z } from "zod";

type ContractConfig = {
  address?: string | null;
  active?: boolean;
  entry_url?: string;
};

function normalizeContracts(raw: unknown): Record<string, ContractConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, ContractConfig> = {};

  Object.entries(raw as Record<string, unknown>).forEach(([chainId, value]) => {
    if (typeof value === "string") {
      result[chainId] = { address: value };
      return;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const obj = value as Record<string, unknown>;
    const address = typeof obj.address === "string" ? obj.address : undefined;
    const entryUrl =
      typeof obj.entry_url === "string" ? obj.entry_url : typeof obj.entryUrl === "string" ? obj.entryUrl : undefined;
    const active = typeof obj.active === "boolean" ? obj.active : undefined;

    result[chainId] = {
      ...(address ? { address } : {}),
      ...(entryUrl ? { entry_url: entryUrl } : {}),
      ...(active !== undefined ? { active } : {}),
    };
  });

  return result;
}

/** Verify the caller owns the app. Shared by GET and POST. */
async function verifyOwnership(
  ctx: { db: import("@supabase/supabase-js").SupabaseClient; address?: string },
  appId: string,
) {
  const { data: app } = await ctx.db
    .from("miniapp_registry")
    .select("app_id")
    .eq("app_id", appId)
    .eq("developer_address", ctx.address!)
    .single();
  return !!app;
}

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const appId = req.query.appId as string;
      if (!appId) return res.status(400).json({ error: "App ID required" });

      if (!(await verifyOwnership(ctx, appId))) {
        return res.status(404).json({ error: "App not found" });
      }

      const { data, error } = await ctx.db
        .from("miniapp_versions")
        .select("*")
        .eq("app_id", appId)
        .order("version_code", { ascending: false });

      if (error) return res.status(500).json({ error: "Failed to list versions" });
      return res.status(200).json({ versions: data || [] });
    },

    POST: {
      rateLimit: "write",
      schema: createVersionBody,
      handler: async (req, res, ctx) => {
        const appId = req.query.appId as string;
        if (!appId) return res.status(400).json({ error: "App ID required" });

        if (!(await verifyOwnership(ctx, appId))) {
          return res.status(404).json({ error: "App not found" });
        }

        const input = ctx.parsedInput as z.infer<typeof createVersionBody>;
        const buildUrl = input.build_url?.trim() || "";

        // Get next version code
        const { data: latest } = await ctx.db
          .from("miniapp_versions")
          .select("version_code")
          .eq("app_id", appId)
          .order("version_code", { ascending: false })
          .limit(1)
          .single();

        const version_code = (latest?.version_code || 0) + 1;
        const supportedChains = input.supported_chains || [];
        const contractMap = normalizeContracts(input.contracts);

        const { data, error } = await ctx.db
          .from("miniapp_versions")
          .insert({
            app_id: appId,
            version: input.version,
            version_code,
            entry_url: input.entry_url,
            supported_chains: supportedChains,
            contracts: contractMap,
            release_notes: input.release_notes,
            status: "draft",
          })
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to create version" });

        if (buildUrl) {
          await ctx.db.from("miniapp_builds").insert({
            version_id: data.id,
            build_number: 1,
            platform: "web",
            storage_path: buildUrl,
            storage_provider: "external",
            status: "ready",
            completed_at: new Date().toISOString(),
          });
        }

        return res.status(201).json({ version: data });
      },
    },
  },
});
