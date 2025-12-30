import type { NextApiRequest, NextApiResponse } from "next";
import { verifyEmail } from "@/lib/notifications/supabase-service";
import { verifyCode } from "@/lib/notifications/verification-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet, code } = req.body;

  if (!wallet || !code) {
    return res.status(400).json({ error: "Wallet and code required" });
  }

  // Verify code matches stored verification code
  const isCodeValid = await verifyCode(wallet, code);
  if (!isCodeValid) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  // Mark email as verified
  const success = await verifyEmail(wallet);
  if (!success) {
    return res.status(500).json({ error: "Failed to verify email" });
  }

  return res.status(200).json({ success: true });
}
