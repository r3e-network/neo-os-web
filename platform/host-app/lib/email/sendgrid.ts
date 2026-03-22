import sgMail from "@sendgrid/mail";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

function getEmailConfig() {
  return {
    sendgridKey: process.env.SENDGRID_API_KEY || "",
    resendKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || "noreply@r3e.network",
  };
}

export function isEmailConfigured(): boolean {
  const { resendKey, sendgridKey } = getEmailConfig();
  return Boolean(resendKey || sendgridKey);
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send email via Resend (preferred) or SendGrid */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { resendKey, sendgridKey, fromEmail } = getEmailConfig();

  if (!resendKey && !sendgridKey) {
    logger.warn("No email provider configured, skipping email");
    return false;
  }

  try {
    if (resendKey) {
      const resendClient = new Resend(resendKey);
      const { error } = await resendClient.emails.send({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      if (error) {
        throw new Error(`sendEmailViaSendGrid: failed to send email to ${options.to} — ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }

    sgMail.setApiKey(sendgridKey);
    await sgMail.send({
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  } catch (error) {
    logger.error("Email sending error:", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
