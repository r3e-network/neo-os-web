/**
 * App Versions API - List and Create Versions
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const developerAddress = req.headers["x-developer-address"] as string;
  if (!developerAddress) {
    return res.status(401).json({ error: "Developer address required" });
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "App ID required" });
  }

  // Verify ownership
  const { data: app } = await supabaseAdmin
    .from("miniapp_registry")
    .select("app_id")
    .eq("app_id", appId)
    .eq("developer_address", developerAddress)
    .single();

  if (!app) {
    return res.status(404).json({ error: "App not found" });
  }

  if (req.method === "GET") {
    return handleGet(res, appId);
  }

  if (req.method === "POST") {
    return handlePost(req, res, appId);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(res: NextApiResponse, appId: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_versions")
      .select("*")
      .eq("app_id", appId)
      .order("version_code", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ versions: data || [] });
  } catch (error) {
    console.error("List versions error:", error);
    return res.status(500).json({ error: "Failed to list versions" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, appId: string) {
  const { version, release_notes, entry_url } = req.body;

  if (!version || !entry_url) {
    return res.status(400).json({ error: "Version and entry_url required" });
  }

  try {
    // Get next version code
    const { data: latest } = await supabaseAdmin!
      .from("miniapp_versions")
      .select("version_code")
      .eq("app_id", appId)
      .order("version_code", { ascending: false })
      .limit(1)
      .single();

    const version_code = (latest?.version_code || 0) + 1;

    const { data, error } = await supabaseAdmin!
      .from("miniapp_versions")
      .insert({
        app_id: appId,
        version,
        version_code,
        entry_url,
        release_notes,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ version: data });
  } catch (error) {
    console.error("Create version error:", error);
    return res.status(500).json({ error: "Failed to create version" });
  }
}
