// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient } from "../_shared/supabase.ts";

interface VerifyRequest {
  app_id: string;
}

export const handler = createHandler(
  { method: "POST", auth: "user", rateLimit: "social-proof-verify" },
  async ({ req, auth }) => {
    let body: VerifyRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const { app_id } = body;
    if (!app_id?.trim()) {
      return validationError("app_id", "app_id is required", req);
    }

    const supabase = supabaseClient();
    const userId = auth.userId;

    // Check existing proof cache
    const { data: cached } = await supabase
      .from("social_proof_of_interaction")
      .select("tx_hash, verified_at")
      .eq("app_id", app_id)
      .eq("user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(5);

    if (cached && cached.length > 0) {
      return json(
        {
          verified: true,
          interaction_count: cached.length,
          first_interaction_at: cached[cached.length - 1].verified_at,
          can_rate: true,
          can_comment: true,
        },
        {},
        req
      );
    }

    // Look up user's wallet address
    const { data: userData } = await supabase.from("users").select("neo_address").eq("id", userId).single();

    if (!userData?.neo_address) {
      return json(
        {
          verified: false,
          interaction_count: 0,
          can_rate: false,
          can_comment: false,
          reason: "no wallet linked",
        },
        {},
        req
      );
    }

    // Check miniapp_tx_events for interactions
    const { data: txEvents } = await supabase
      .from("miniapp_tx_events")
      .select("tx_hash, created_at")
      .eq("app_id", app_id)
      .eq("sender_address", userData.neo_address)
      .order("created_at", { ascending: true })
      .limit(10);

    if (!txEvents || txEvents.length === 0) {
      return json(
        {
          verified: false,
          interaction_count: 0,
          can_rate: false,
          can_comment: false,
          reason: "no transactions found",
        },
        {},
        req
      );
    }

    // Cache the proof
    const proofRecords = txEvents.map((tx) => ({
      app_id,
      user_id: userId,
      tx_hash: tx.tx_hash,
      interaction_type: "transaction",
    }));

    await supabase.from("social_proof_of_interaction").upsert(proofRecords, { onConflict: "app_id,user_id,tx_hash" });

    return json(
      {
        verified: true,
        interaction_count: txEvents.length,
        first_interaction_at: txEvents[0].created_at,
        can_rate: true,
        can_comment: true,
      },
      {},
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
