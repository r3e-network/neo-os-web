import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { generateReportBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => getReports(ctx.db, ctx.address!, req, res),
    POST: {
      handler: (req, res, ctx) => generateReport(ctx.db, ctx.address!, req, res),
      schema: generateReportBody,
    },
  },
});

async function getReports(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const { data, error } = await db
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

async function generateReport(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { report_type, date_from, date_to } = req.body;

  const reportData = {
    total_executions: 0,
    total_gas_used: 0,
    apps_used: [],
  };

  const { data, error } = await db
    .from("usage_reports")
    .insert({ wallet_address: wallet, report_type, date_from, date_to, data: reportData })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to generate report" });
  }

  return res.status(201).json({ report: data });
}
