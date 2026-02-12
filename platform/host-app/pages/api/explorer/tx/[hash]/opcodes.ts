import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";

/**
 * GET /api/explorer/tx/[hash]/opcodes
 * Returns opcode traces for a transaction (only available for complex transactions)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { hash } = req.query;
  if (!hash || typeof hash !== "string") {
    return res.status(400).json({ error: "Transaction hash required" });
  }

  // Validate hash format (0x + 64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return res.status(400).json({ error: "Invalid transaction hash format" });
  }

  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      return res.status(500).json({ error: "Indexer not configured" });
    }

    // First check if transaction exists and its type
    const txResponse = await fetch(
      `${indexerUrl}/rest/v1/indexer_transactions?hash=eq.${hash}&select=hash,tx_type,script,vm_state,gas_consumed`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
      },
    );

    const txData = await txResponse.json();
    if (!txData || txData.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = txData[0];

    // For simple transactions, opcodes are not stored
    if (tx.tx_type === "simple") {
      return res.status(200).json({
        hash,
        tx_type: "simple",
        message: "Opcode traces not available for simple transfers",
        opcodes: [],
      });
    }

    // Fetch opcode traces for complex transactions
    const tracesResponse = await fetch(
      `${indexerUrl}/rest/v1/indexer_opcode_traces?tx_hash=eq.${hash}&order=step_index.asc`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
      },
    );

    const traces = await tracesResponse.json();

    // Fetch contract calls for context
    const callsResponse = await fetch(
      `${indexerUrl}/rest/v1/indexer_contract_calls?tx_hash=eq.${hash}&order=call_index.asc`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
      },
    );

    const calls = await callsResponse.json();

    return res.status(200).json({
      hash,
      tx_type: tx.tx_type,
      vm_state: tx.vm_state,
      gas_consumed: tx.gas_consumed,
      opcodes: traces || [],
      contract_calls: calls || [],
      total_steps: traces?.length || 0,
    });
  } catch (error) {
    logger.error("Opcodes API error", error);
    return res.status(500).json({ error: "Failed to fetch opcodes" });
  }
}
