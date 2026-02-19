import type { NextApiRequest, NextApiResponse } from "next";
import { verifyEmail } from "@/lib/notifications/supabase-service";
import { verifyCode } from "@/lib/notifications/verification-service";
import { withCsrfProtection } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { strictLimit } from "@/lib/rate-limit";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  const { wallet, code } = req.body;

  if (!wallet || typeof wallet !== "string" || !code || typeof code !== "string") {
    return apiError.badRequest(res, "Wallet and code required");
  }

  // Basic format validation
  if (!/^N[A-Za-z0-9]{33}$/.test(wallet) || !/^\d{6}$/.test(code)) {
    return apiError.badRequest(res, "Invalid wallet or code format");
  }

  // Verify code matches stored verification code
  const isCodeValid = await verifyCode(wallet, code);
  if (!isCodeValid) {
    return apiError.badRequest(res, "Invalid or expired code");
  }

  // Mark email as verified
  const success = await verifyEmail(wallet);
  if (!success) {
    return apiError.internal(res, "Failed to verify email");
  }

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({ success: true });
}

export default withCsrfProtection(handler);
