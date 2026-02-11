import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { createSubscriptionBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => handleGet(ctx.db, ctx.address!, req, res),
    POST: {
      handler: (req, res, ctx) => handlePost(ctx.db, ctx.address!, req, res),
      schema: createSubscriptionBody,
    },
  },
});

async function handleGet(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const { data, count } = await db
    .from("app_subscriptions")
    .select("*", { count: "exact" })
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return res.status(200).json({
    subscriptions: data || [],
    total: count ?? 0,
    has_more: (count ?? 0) > offset + limit,
  });
}

async function handlePost(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { app_id, plan } = req.body;
  const { data, error } = await db
    .from("app_subscriptions")
    .upsert({ wallet_address: wallet, app_id, plan, status: "active" })
    .select()
    .single();
  if (error) return res.status(500).json({ error: "Failed" });
  return res.status(201).json({ subscription: data });
}
