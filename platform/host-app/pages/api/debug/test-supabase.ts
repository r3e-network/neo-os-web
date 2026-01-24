import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found" });
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    supabaseAdmin_available: !!supabaseAdmin,
    supabase_available: !!supabase,
  };

  // Test with admin client
  if (supabaseAdmin) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from("simulation_txs")
        .select("*", { count: "exact" })
        .limit(3);

      results.admin_query = {
        success: !error,
        count: count,
        sample: data?.slice(0, 2),
        error: error?.message,
      };
    } catch (e) {
      results.admin_query = { error: String(e) };
    }
  }

  // Test with anon client
  try {
    const { data, error } = await supabase.from("simulation_txs").select("*").limit(2);

    results.anon_query = {
      success: !error,
      count: data?.length,
      error: error?.message,
    };
  } catch (e) {
    results.anon_query = { error: String(e) };
  }

  return res.status(200).json(results);
}
