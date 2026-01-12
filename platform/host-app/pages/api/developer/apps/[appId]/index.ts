/**
 * Developer App Detail API - Get, Update, Delete single app
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

  switch (req.method) {
    case "GET":
      return handleGet(res, appId, developerAddress);
    case "PUT":
      return handleUpdate(req, res, appId, developerAddress);
    case "DELETE":
      return handleDelete(res, appId, developerAddress);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(res: NextApiResponse, appId: string, developerAddress: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .select("*")
      .eq("app_id", appId)
      .eq("developer_address", developerAddress)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "App not found" });
    }

    return res.status(200).json({ app: data });
  } catch (error) {
    console.error("Get app error:", error);
    return res.status(500).json({ error: "Failed to get app" });
  }
}

async function handleUpdate(req: NextApiRequest, res: NextApiResponse, appId: string, developerAddress: string) {
  const updates = req.body;

  // Prevent updating protected fields
  delete updates.app_id;
  delete updates.developer_address;
  delete updates.created_at;

  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("app_id", appId)
      .eq("developer_address", developerAddress)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ app: data });
  } catch (error) {
    console.error("Update app error:", error);
    return res.status(500).json({ error: "Failed to update app" });
  }
}

async function handleDelete(res: NextApiResponse, appId: string, developerAddress: string) {
  try {
    const { error } = await supabaseAdmin!
      .from("miniapp_registry")
      .delete()
      .eq("app_id", appId)
      .eq("developer_address", developerAddress);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete app error:", error);
    return res.status(500).json({ error: "Failed to delete app" });
  }
}
