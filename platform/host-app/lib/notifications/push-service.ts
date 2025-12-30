/**
 * Push Notification Service
 * Unified service for sending notifications across multiple channels
 */
import { sendNotificationEmail } from "./email-trigger";
import { createEvent } from "./supabase-service";
import type { NotificationType } from "./types";

export interface PushNotificationPayload {
  wallet: string;
  type: NotificationType;
  title: string;
  content: string;
  metadata?: {
    appId?: string;
    appName?: string;
    amount?: string;
    txHash?: string;
    network?: "testnet" | "mainnet";
  };
}

export interface PushResult {
  inApp: boolean;
  email: boolean;
  errors: string[];
}

/**
 * Send notification to user across all enabled channels
 */
export async function pushNotification(payload: PushNotificationPayload): Promise<PushResult> {
  const result: PushResult = { inApp: false, email: false, errors: [] };

  // 1. Always create in-app notification
  try {
    await createEvent(payload.wallet, payload.type, payload.title, payload.content, payload.metadata || {});
    result.inApp = true;
  } catch (err) {
    result.errors.push(`In-app: ${err instanceof Error ? err.message : "Failed"}`);
  }

  // 2. Send email if enabled
  try {
    const emailSent = await sendNotificationEmail({
      wallet: payload.wallet,
      type: payload.type,
      appName: payload.metadata?.appName,
      amount: payload.metadata?.amount,
      txHash: payload.metadata?.txHash,
      network: payload.metadata?.network,
    });
    result.email = emailSent;
  } catch (err) {
    result.errors.push(`Email: ${err instanceof Error ? err.message : "Failed"}`);
  }

  return result;
}

/** Notify user of MiniApp win */
export function notifyWin(wallet: string, appName: string, amount: string, txHash?: string) {
  return pushNotification({
    wallet,
    type: "miniapp_win",
    title: `🎉 You won ${amount} GAS!`,
    content: `Congratulations! You won in ${appName}.`,
    metadata: { appName, amount, txHash },
  });
}

/** Notify user of MiniApp loss */
export function notifyLoss(wallet: string, appName: string, amount: string) {
  return pushNotification({
    wallet,
    type: "miniapp_loss",
    title: `Game ended`,
    content: `Your ${amount} GAS entry in ${appName} did not win this round.`,
    metadata: { appName, amount },
  });
}

/** Notify user of balance deposit */
export function notifyDeposit(wallet: string, amount: string, txHash: string) {
  return pushNotification({
    wallet,
    type: "balance_deposit",
    title: `💰 Deposit received`,
    content: `${amount} GAS has been deposited to your account.`,
    metadata: { amount, txHash },
  });
}

/** Notify user of balance withdrawal */
export function notifyWithdraw(wallet: string, amount: string, txHash: string) {
  return pushNotification({
    wallet,
    type: "balance_withdraw",
    title: `📤 Withdrawal sent`,
    content: `${amount} GAS has been withdrawn from your account.`,
    metadata: { amount, txHash },
  });
}
