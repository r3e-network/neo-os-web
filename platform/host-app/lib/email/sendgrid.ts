import sgMail from "@sendgrid/mail";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

const sendgridKey = process.env.SENDGRID_API_KEY || "";
const resendKey = process.env.RESEND_API_KEY || "";
const fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || "noreply@r3e.network";

let resendClient: Resend | null = null;

if (resendKey) {
  resendClient = new Resend(resendKey);
} else if (sendgridKey) {
  sgMail.setApiKey(sendgridKey);
}

export const isEmailConfigured = Boolean(resendKey || sendgridKey);

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send email via Resend (preferred) or SendGrid */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isEmailConfigured) {
    logger.warn("No email provider configured, skipping email");
    return false;
  }

  try {
    if (resendClient) {
      const { error } = await resendClient.emails.send({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } else {
      await sgMail.send({
        to: options.to,
        from: fromEmail,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return true;
    }
  } catch (error) {
    logger.error("Email sending error:", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
