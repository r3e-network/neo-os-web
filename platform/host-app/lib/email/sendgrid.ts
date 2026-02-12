import sgMail from "@sendgrid/mail";
import { logger } from "@/lib/logger";

const apiKey = process.env.SENDGRID_API_KEY || "";
const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@r3e.network";

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export const isEmailConfigured = Boolean(apiKey);

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send email via SendGrid */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isEmailConfigured) {
    logger.warn("SendGrid not configured, skipping email");
    return false;
  }

  try {
    await sgMail.send({
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  } catch (error) {
    logger.error("SendGrid error:", error);
    return false;
  }
}
