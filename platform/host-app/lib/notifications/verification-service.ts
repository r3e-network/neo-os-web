import { supabase, isSupabaseConfigured } from "../supabase";

const TABLE_NAME = "email_verifications";
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/** Generate 6-digit verification code */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Store verification code */
export async function storeCode(wallet: string, code: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString();

  const { error } = await supabase.from(TABLE_NAME).upsert({
    wallet_address: wallet,
    code,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  return !error;
}

/** Verify code */
export async function verifyCode(wallet: string, code: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("code, expires_at")
    .eq("wallet_address", wallet)
    .single();

  if (error || !data) return false;

  const isValid = data.code === code && new Date(data.expires_at) > new Date();

  if (isValid) {
    await supabase.from(TABLE_NAME).delete().eq("wallet_address", wallet);
  }

  return isValid;
}
