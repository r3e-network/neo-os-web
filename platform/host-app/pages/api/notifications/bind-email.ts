import type { NextApiRequest, NextApiResponse } from "next";
import { bindEmail } from "@/lib/notifications/supabase-service";
import { generateCode, storeCode } from "@/lib/notifications/verification-service";
import { sendEmail, verificationEmail } from "@/lib/email";
import { isValidEmail, sanitizeInput } from "@/lib/utils";
import { withCsrfProtection } from "@/lib/csrf";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet, email } = req.body;

  if (!wallet || !email) {
    return res.status(400).json({ error: "Wallet and email required" });
  }

  // Sanitize inputs
  const sanitizedEmail = sanitizeInput(email).toLowerCase();
  const sanitizedWallet = sanitizeInput(wallet);

  // Validate email format with strict RFC 5322 compliant regex
  if (!isValidEmail(sanitizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Save email to Supabase (unverified)
  const success = await bindEmail(sanitizedWallet, sanitizedEmail);
  if (!success) {
    return res.status(500).json({ error: "Failed to bind email" });
  }

  // Generate and store verification code
  const code = generateCode();
  await storeCode(sanitizedWallet, code);

  // Send verification email
  const template = verificationEmail({ code, walletAddress: sanitizedWallet });
  await sendEmail({ to: sanitizedEmail, ...template });

  return res.status(200).json({
    success: true,
    message: "Verification code sent to email.",
  });
}

export default withCsrfProtection(handler);
