import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getContracts(req, res);
  }

  if (req.method === "POST") {
    return createContract(req, res);
  }

  if (req.method === "DELETE") {
    return revokeContract(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getContracts(req: NextApiRequest, res: NextApiResponse) {
  const { appId, role } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  const column = role === "consumer" ? "consumer_app_id" : "provider_app_id";

  const { data, error } = await supabase
    .from("shared_data_contracts")
    .select("*")
    .eq(column, appId)
    .eq("status", "active");

  if (error) {
    return res.status(500).json({ error: "Failed to fetch contracts" });
  }

  return res.status(200).json({ contracts: data || [] });
}

async function createContract(req: NextApiRequest, res: NextApiResponse) {
  const { provider_app_id, consumer_app_id, data_schema, permissions } = req.body;

  if (!provider_app_id || !consumer_app_id || !data_schema) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { data, error } = await supabase
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

  if (error) {
    return res.status(500).json({ error: "Failed to create contract" });
  }

  return res.status(201).json({ contract: data });
}

async function revokeContract(req: NextApiRequest, res: NextApiResponse) {
  const { contract_id } = req.body;

  if (!contract_id) {
    return res.status(400).json({ error: "Missing contract_id" });
  }

  const { error } = await supabase
    .from("shared_data_contracts")
    .update({ status: "revoked" })
    .eq("contract_id", contract_id);

  if (error) {
    return res.status(500).json({ error: "Failed to revoke contract" });
  }

  return res.status(200).json({ success: true });
}
