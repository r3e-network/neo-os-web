import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (req.method === "GET") {
    return getVersions(appId, res);
  }

  if (req.method === "POST") {
    return createVersion(appId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getVersions(appId: string, res: NextApiResponse) {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .eq("app_id", appId)
    .order("published_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch versions" });
  }

  return res.status(200).json({ versions: data || [] });
}

async function createVersion(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { version, entry_url, contract_hash, changelog, release_notes, is_current, published_by } = req.body;

  if (!version || !entry_url || !published_by) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { data, error } = await supabase
    .from("app_versions")
    .insert({
      app_id: appId,
      version,
      entry_url,
      contract_hash,
      changelog,
      release_notes,
      is_current: is_current ?? true,
      published_by,
    })
    .select()
    .single();

  if (error?.code === "23505") {
    return res.status(409).json({ error: "Version already exists" });
  }

  if (error) {
    return res.status(500).json({ error: "Failed to create version" });
  }

  return res.status(201).json({ version: data });
}
