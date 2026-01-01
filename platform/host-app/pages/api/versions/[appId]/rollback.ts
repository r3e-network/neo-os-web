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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to_version, reason, rolled_back_by } = req.body;

  if (!to_version || !rolled_back_by) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Get current version
  const { data: current } = await supabase
    .from("app_versions")
    .select("version")
    .eq("app_id", appId)
    .eq("is_current", true)
    .single();

  if (!current) {
    return res.status(404).json({ error: "No current version found" });
  }

  // Set target version as current
  const { error: updateError } = await supabase
    .from("app_versions")
    .update({ is_current: true })
    .eq("app_id", appId)
    .eq("version", to_version);

  if (updateError) {
    return res.status(500).json({ error: "Failed to rollback" });
  }

  // Record rollback
  await supabase.from("version_rollbacks").insert({
    app_id: appId,
    from_version: current.version,
    to_version,
    reason,
    rolled_back_by,
  });

  return res.status(200).json({ success: true, from: current.version, to: to_version });
}
