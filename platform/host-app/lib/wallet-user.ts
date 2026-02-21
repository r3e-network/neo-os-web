import type { SupabaseClient } from "@supabase/supabase-js";

const WALLET_REGEX = /^N[A-Za-z0-9]{33}$/;

export function isValidWalletAddress(value: unknown): value is string {
  return typeof value === "string" && WALLET_REGEX.test(value.trim());
}

export function formatWalletDisplayName(wallet: string): string {
  const normalized = wallet.trim();
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

async function findUserByWallet(supabase: SupabaseClient, wallet: string): Promise<string | null> {
  const normalized = wallet.trim();

  const { data: directUser } = await supabase.from("users").select("id").eq("address", normalized).maybeSingle();
  if (directUser?.id) return directUser.id as string;

  const { data: directWallet } = await supabase
    .from("user_wallets")
    .select("user_id")
    .eq("address", normalized)
    .maybeSingle();
  if (directWallet?.user_id) return directWallet.user_id as string;

  // Case-insensitive fallback to handle legacy rows with inconsistent casing.
  const escaped = normalized.replace(/[%_\\]/g, "\\$&");
  const { data: ciUser } = await supabase.from("users").select("id").ilike("address", escaped).maybeSingle();
  if (ciUser?.id) return ciUser.id as string;

  const { data: ciWallet } = await supabase
    .from("user_wallets")
    .select("user_id")
    .ilike("address", escaped)
    .maybeSingle();
  if (ciWallet?.user_id) return ciWallet.user_id as string;

  return null;
}

export async function resolveUserIdFromWallet(
  supabase: SupabaseClient,
  wallet: string,
  options: { createIfMissing?: boolean } = {},
): Promise<string | null> {
  const normalized = wallet.trim();
  const existingId = await findUserByWallet(supabase, normalized);
  if (existingId) return existingId;
  if (!options.createIfMissing) return null;

  const { data: inserted, error } = await supabase.from("users").insert({ address: normalized }).select("id").single();
  if (error && error.code !== "23505") {
    return null;
  }

  const userId = (inserted?.id as string | undefined) || (await findUserByWallet(supabase, normalized));
  if (!userId) return null;

  // Best-effort wallet mapping for features that resolve wallet->user through user_wallets.
  await supabase.from("user_wallets").insert({
    user_id: userId,
    address: normalized,
    is_primary: true,
    verified: true,
  });

  return userId;
}

