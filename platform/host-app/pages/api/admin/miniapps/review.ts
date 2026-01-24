import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

type ReviewAction = "approve" | "reject" | "request_changes";

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ success: boolean } | { error: string }>) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAdmin(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const { app_id, version_id, action, notes, reviewer } = req.body || {};
  const safeAction = String(action || "").toLowerCase() as ReviewAction;
  if (!app_id || !version_id || !["approve", "reject", "request_changes"].includes(safeAction)) {
    return res.status(400).json({ error: "app_id, version_id, and valid action are required" });
  }

  try {
    const { data: version, error: versionError } = await supabaseAdmin
      .from("miniapp_versions")
      .select("id,app_id,supported_chains,contracts")
      .eq("id", version_id)
      .eq("app_id", app_id)
      .single();

    if (versionError || !version) {
      return res.status(404).json({ error: "Version not found" });
    }

    const reviewedBy = typeof reviewer === "string" && reviewer.trim() ? reviewer.trim() : "admin";
    const reviewNotes = typeof notes === "string" ? notes.trim() : null;
    const reviewedAt = new Date().toISOString();

    if (safeAction === "approve") {
      const { error: reviewError } = await supabaseAdmin
        .from("miniapp_versions")
        .update({
          reviewed_by: reviewedBy,
          reviewed_at: reviewedAt,
          review_notes: reviewNotes,
          status: "approved",
        })
        .eq("id", version_id)
        .eq("app_id", app_id);

      if (reviewError) throw reviewError;

      await supabaseAdmin
        .from("miniapp_registry")
        .update({
          supported_chains: version.supported_chains || [],
          contracts: version.contracts || {},
          status: "approved",
          visibility: "public",
          updated_at: reviewedAt,
        })
        .eq("app_id", app_id);

      const { error: publishError } = await supabaseAdmin.rpc("publish_version", { p_version_id: version_id });
      if (publishError) throw publishError;

      return res.status(200).json({ success: true });
    }

    const downgradeStatus = safeAction === "reject" ? "deprecated" : "draft";
    const { error: rejectError } = await supabaseAdmin
      .from("miniapp_versions")
      .update({
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        review_notes: reviewNotes,
        status: downgradeStatus,
        is_current: false,
      })
      .eq("id", version_id)
      .eq("app_id", app_id);

    if (rejectError) throw rejectError;

    await supabaseAdmin
      .from("miniapp_registry")
      .update({
        status: "draft",
        visibility: "private",
        updated_at: reviewedAt,
      })
      .eq("app_id", app_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Review action error:", error);
    return res.status(500).json({ error: "Failed to update review status" });
  }
}
