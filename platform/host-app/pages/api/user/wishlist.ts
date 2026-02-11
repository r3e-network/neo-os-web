/**
 * Wishlist API - Add/Remove apps from wishlist
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { wishlistBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => handleGet(ctx.db, ctx.address!, res),
    POST: {
      handler: (req, res, ctx) => handleAdd(ctx.db, ctx.address!, req, res),
      schema: wishlistBody,
    },
    DELETE: {
      handler: (req, res, ctx) => handleRemove(ctx.db, ctx.address!, req, res),
      schema: wishlistBody,
    },
  },
});

async function handleGet(db: SupabaseClient, walletAddress: string, res: NextApiResponse) {
  try {
    const { data, error } = await db
      .from("miniapp_wishlist")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ wishlist: data || [] });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({ error: "Failed to get wishlist" });
  }
}

async function handleAdd(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  const { app_id } = req.body;

  try {
    const { data, error } = await db
      .from("miniapp_wishlist")
      .upsert({ wallet_address: walletAddress, app_id }, { onConflict: "wallet_address,app_id" })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ item: data });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({ error: "Failed to add to wishlist" });
  }
}

async function handleRemove(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  const { app_id } = req.body;

  try {
    await db.from("miniapp_wishlist").delete().eq("wallet_address", walletAddress).eq("app_id", app_id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({ error: "Failed to remove from wishlist" });
  }
}
