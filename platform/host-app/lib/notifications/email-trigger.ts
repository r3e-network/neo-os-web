import { sendEmail, transactionEmail, chainAlertEmail } from "../email";
import { getPreferences } from "./supabase-service";
import type { NotificationType } from "./types";

interface NotifyOptions {
  wallet: string;
  type: NotificationType;
  appName?: string;
  amount?: string;
  txHash?: string;
  network?: "testnet" | "mainnet";
  details?: string;
}

/** Send notification email based on user preferences */
export async function sendNotificationEmail(opts: NotifyOptions): Promise<boolean> {
  const prefs = await getPreferences(opts.wallet);

  // Check if user has verified email and enabled notifications
  if (!prefs?.email || !prefs.emailVerified) return false;

  // Check notification type preferences
  const typeMap: Record<string, keyof typeof prefs> = {
    miniapp_win: "notifyMiniappResults",
    miniapp_loss: "notifyMiniappResults",
    balance_deposit: "notifyBalanceChanges",
    balance_withdraw: "notifyBalanceChanges",
    chain_no_block: "notifyChainAlerts",
    chain_congestion: "notifyChainAlerts",
  };

  const prefKey = typeMap[opts.type];
  if (prefKey && !prefs[prefKey]) return false;

  // Build and send email
  const template = buildTemplate(opts);
  if (!template) return false;

  return sendEmail({ to: prefs.email, ...template });
}

/** Build email template based on notification type */
function buildTemplate(opts: NotifyOptions) {
  const { type, appName, amount, txHash, network, details } = opts;

  if (type === "miniapp_win" || type === "miniapp_loss") {
    return transactionEmail({
      type: type === "miniapp_win" ? "win" : "loss",
      appName: appName || "MiniApp",
      amount: amount || "0",
      txHash,
    });
  }

  if (type === "balance_deposit" || type === "balance_withdraw") {
    return transactionEmail({
      type: type === "balance_deposit" ? "deposit" : "withdraw",
      appName: appName || "Wallet",
      amount: amount || "0",
      txHash,
    });
  }

  if (type === "chain_no_block" || type === "chain_congestion") {
    return chainAlertEmail({
      network: network || "testnet",
      alertType: type === "chain_no_block" ? "no_block" : "congestion",
      details: details || "Network issue detected",
    });
  }

  return null;
}
