/**
 * Developer Apps API - List and Create Apps
 * GET: List developer's apps
 * POST: Create new app
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export interface DeveloperApp {
  id: string;
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  icon_url?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const developerAddress = req.headers["x-developer-address"] as string;
  if (!developerAddress) {
    return res.status(401).json({ error: "Developer address required" });
  }

  if (req.method === "GET") {
    return handleGet(req, res, developerAddress);
  }

  if (req.method === "POST") {
    return handlePost(req, res, developerAddress);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, developerAddress: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .select("*")
      .eq("developer_address", developerAddress)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ apps: data || [] });
  } catch (error) {
    console.error("List apps error:", error);
    return res.status(500).json({ error: "Failed to list apps" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, developerAddress: string) {
  const { name, description, category } = req.body;

  if (!name || !description || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate app_id from name
  const app_id = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .insert({
        app_id,
        developer_address: developerAddress,
        name,
        description,
        category,
        status: "draft",
        visibility: "private",
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ app: data });
  } catch (error) {
    console.error("Create app error:", error);
    return res.status(500).json({ error: "Failed to create app" });
  }
}
