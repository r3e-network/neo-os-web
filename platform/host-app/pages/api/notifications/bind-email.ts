import type { NextApiRequest, NextApiResponse } from "next";
import { bindEmail } from "@/lib/notifications/supabase-service";
import { generateCode, storeCode } from "@/lib/notifications/verification-service";
import { sendEmail, verificationEmail } from "@/lib/email";
import { isValidEmail, sanitizeInput } from "@/lib/utils";
import { withCsrfProtection } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { strictLimit } from "@/lib/rate-limit";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  const { wallet, email } = req.body;

  if (!wallet || !email) {
    return apiError.badRequest(res, "Wallet and email required");
  }

  // Sanitize inputs
  const sanitizedEmail = sanitizeInput(email).toLowerCase();
  const sanitizedWallet = sanitizeInput(wallet);

  // Validate email format with strict RFC 5322 compliant regex
  if (!isValidEmail(sanitizedEmail)) {
    return apiError.badRequest(res, "Invalid email format");
  }

  // Save email to Supabase (unverified)
  const success = await bindEmail(sanitizedWallet, sanitizedEmail);
  if (!success) {
    return apiError.internal(res, "Failed to bind email");
  }

  // Generate and store verification code
  const code = generateCode();
  await storeCode(sanitizedWallet, code);

  // Send verification email
  const template = verificationEmail({ code, walletAddress: sanitizedWallet });
  try {
    await sendEmail({ to: sanitizedEmail, ...template });
  } catch (err) {
    logger.error("Failed to send verification email:", err instanceof Error ? err.message : "unknown error");
    return apiError.gatewayError(res, "Failed to send verification email");
  }

  return res.status(200).json({
    success: true,
    message: "Verification code sent to email.",
  });
}

export default withCsrfProtection(handler);
