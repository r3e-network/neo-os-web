// Email templates for notification system

import type { ChainId } from "../chains/types";

export interface VerificationEmailData {
  code: string;
  walletAddress: string;
}

export function verificationEmail(data: VerificationEmailData) {
  const { code, walletAddress } = data;
  const shortWallet = `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`;

  return {
    subject: "R3E Network - Email Verification Code",
    text: `Your verification code is: ${code}\n\nWallet: ${shortWallet}\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00E599;">R3E Network</h2>
        <p>Your email verification code:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          Wallet: ${shortWallet}<br/>
          This code expires in 10 minutes.
        </p>
      </div>
    `,
  };
}

// Transaction notification template
export interface TransactionEmailData {
  type: "win" | "loss" | "deposit" | "withdraw";
  appName: string;
  amount: string;
  txHash?: string;
}

export function transactionEmail(data: TransactionEmailData) {
  const { type, appName, amount, txHash } = data;
  const titles: Record<string, string> = {
    win: "🎉 You Won!",
    loss: "Game Result",
    deposit: "💰 Deposit Confirmed",
    withdraw: "📤 Withdrawal Processed",
  };

  return {
    subject: `R3E Network - ${titles[type]}`,
    text: `${titles[type]}\nApp: ${appName}\nAmount: ${amount}${txHash ? `\nTx: ${txHash}` : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00E599;">R3E Network</h2>
        <h3>${titles[type]}</h3>
        <p><strong>App:</strong> ${appName}</p>
        <p><strong>Amount:</strong> ${amount}</p>
        ${txHash ? `<p style="font-size: 12px; color: #666;">Tx: ${txHash}</p>` : ""}
      </div>
    `,
  };
}

// Chain health alert template
export interface ChainAlertEmailData {
  chainId: ChainId;
  alertType: "no_block" | "congestion";
  details: string;
}

export function chainAlertEmail(data: ChainAlertEmailData) {
  const { chainId, alertType, details } = data;
  const alertTitles = {
    no_block: "⚠️ Block Production Stalled",
    congestion: "⚠️ Network Congestion Detected",
  };

  return {
    subject: `R3E Network - ${alertTitles[alertType]} (${chainId})`,
    text: `${alertTitles[alertType]}\nChain: ${chainId}\n${details}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00E599;">R3E Network</h2>
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0;">${alertTitles[alertType]}</h3>
          <p><strong>Chain:</strong> ${chainId}</p>
          <p>${details}</p>
        </div>
      </div>
    `,
  };
}
