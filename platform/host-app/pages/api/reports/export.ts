import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  if (req.method === "GET") {
    return getExportJobs(wallet, res);
  }

  if (req.method === "POST") {
    return createExportJob(wallet, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getExportJobs(wallet: string, res: NextApiResponse) {
  const { data, error } = await supabase
    .from("export_jobs")
    .select("*")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: "Failed to fetch export jobs" });
  }

  return res.status(200).json({ jobs: data || [] });
}

async function createExportJob(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { export_type, filters } = req.body;

  if (!export_type || !["csv", "json", "pdf"].includes(export_type)) {
    return res.status(400).json({ error: "Invalid export type" });
  }

  const { data, error } = await supabase
    .from("export_jobs")
    .insert({
      wallet_address: wallet,
      export_type,
      filters: filters || {},
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to create export job" });
  }

  return res.status(201).json({ job: data });
}
