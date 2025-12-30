import { sendEmail, chainAlertEmail } from "../email";
import { getPreferences } from "../notifications/supabase-service";
import { supabase, isSupabaseConfigured } from "../supabase";

// Alert thresholds (in seconds)
export const THRESHOLDS = {
  WARNING_BLOCK_DELAY: 60,
  CRITICAL_BLOCK_DELAY: 120,
  WARNING_TX_PENDING: 100,
  CRITICAL_TX_PENDING: 500,
};

export interface ChainStatus {
  network: "testnet" | "mainnet";
  blockHeight: number;
  lastBlockTime: number;
  timeSinceBlock: number;
  status: "healthy" | "warning" | "critical";
  alerts: string[];
}

const NEO_RPC = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
};

/** Check chain health status */
export async function checkChainStatus(network: "testnet" | "mainnet"): Promise<ChainStatus> {
  const rpcUrl = NEO_RPC[network];
  const alerts: string[] = [];

  // Get block count
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "getblockcount", params: [], id: 1 }),
  });
  const blockData = await blockRes.json();
  const blockHeight = blockData.result || 0;

  // Get latest block header
  const headerRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "getblockheader", params: [blockHeight - 1, true], id: 2 }),
  });
  const headerData = await headerRes.json();
  const lastBlockTime = headerData.result?.time || 0;

  const now = Math.floor(Date.now() / 1000);
  const timeSinceBlock = now - lastBlockTime;

  // Determine status
  let status: "healthy" | "warning" | "critical" = "healthy";

  if (timeSinceBlock > THRESHOLDS.CRITICAL_BLOCK_DELAY) {
    status = "critical";
    alerts.push(`No new block for ${timeSinceBlock}s`);
  } else if (timeSinceBlock > THRESHOLDS.WARNING_BLOCK_DELAY) {
    status = "warning";
    alerts.push(`Block delay: ${timeSinceBlock}s`);
  }

  return { network, blockHeight, lastBlockTime, timeSinceBlock, status, alerts };
}

/** Send chain alerts to subscribed users */
export async function sendChainAlerts(status: ChainStatus): Promise<number> {
  if (status.status === "healthy" || !isSupabaseConfigured) return 0;

  // Get users with chain alerts enabled
  const { data: users } = await supabase
    .from("notification_preferences")
    .select("wallet_address, email")
    .eq("notify_chain_alerts", true)
    .eq("email_verified", true);

  if (!users?.length) return 0;

  let sent = 0;
  const alertType = status.timeSinceBlock > THRESHOLDS.CRITICAL_BLOCK_DELAY ? "no_block" : "congestion";

  for (const user of users) {
    if (!user.email) continue;

    const template = chainAlertEmail({
      network: status.network,
      alertType,
      details: status.alerts.join(", "),
    });

    const success = await sendEmail({ to: user.email, ...template });
    if (success) sent++;
  }

  return sent;
}
