/**
 * Email Test Script
 * Run: npx ts-node --skip-project scripts/test-email.ts
 */

import sgMail from "@sendgrid/mail";

const API_KEY = process.env.SENDGRID_API_KEY;

if (!API_KEY) {
  console.error("Error: SENDGRID_API_KEY environment variable is required");
  process.exit(1);
}
const FROM_EMAIL = "noreply@r3e.network";
const TEST_EMAIL = process.argv[2];

if (!TEST_EMAIL) {
  console.error("Usage: npx ts-node scripts/test-email.ts <your-email>");
  process.exit(1);
}

sgMail.setApiKey(API_KEY);

async function testEmail() {
  console.log(`Sending test email to: ${TEST_EMAIL}`);

  try {
    await sgMail.send({
      to: TEST_EMAIL,
      from: FROM_EMAIL,
      subject: "R3E Network - Test Email",
      text: "This is a test email from R3E Network.",
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00E599;">R3E Network</h2>
          <p>Test email sent successfully!</p>
          <p>Your verification code: <strong>123456</strong></p>
        </div>
      `,
    });

    console.log("✅ Email sent successfully!");
  } catch (error: unknown) {
    console.error("❌ Failed to send email:");

    const sendGridError = error as { response?: { body?: unknown }; message?: string };
    console.error(sendGridError.response?.body ?? sendGridError.message ?? error);
  }
}

testEmail();
