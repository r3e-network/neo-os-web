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
    return getReports(wallet, req, res);
  }

  if (req.method === "POST") {
    return generateReport(wallet, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getReports(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const { data, error } = await supabase
    .from("usage_reports")
    .select("*")
    .eq("wallet_address", wallet)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: "Failed to fetch reports" });
  }

  return res.status(200).json({ reports: data || [] });
}

async function generateReport(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { report_type, date_from, date_to } = req.body;

  if (!report_type || !date_from || !date_to) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate report data (simplified)
  const reportData = {
    total_executions: 0,
    total_gas_used: 0,
    apps_used: [],
  };

  const { data, error } = await supabase
    .from("usage_reports")
    .insert({
      wallet_address: wallet,
      report_type,
      date_from,
      date_to,
      data: reportData,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to generate report" });
  }

  return res.status(201).json({ report: data });
}
