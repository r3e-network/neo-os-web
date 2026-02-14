/**
 * Hybrid Tarot Drawing Example
 *
 * This file demonstrates how to use the two-phase hybrid computation flow
 * for the On-Chain Tarot MiniApp.
 *
 * Flow:
 * 1. InitiateReading (on-chain) - generates seed, returns readingId + seed
 * 2. calculate-cards (off-chain TEE) - computes cards from seed
 * 3. SettleReading (on-chain) - verifies and stores cards
 */

import type { ComputeVerifiedRequest } from "./useHybridCompute";
import { useHybridCompute } from "./useHybridCompute";
import { extractTxid, waitForEventByTransaction } from "@shared/utils/transaction";

// Contract and app configuration
const APP_ID = "on-chain-tarot";
const SCRIPT_NAME = "calculate-cards";

export type InitiateReadingResult = {
  readingId: string;
  seed: string;
  cardCount: number;
  txid: string;
};

export type CardCalculationResult = {
  cards: number[];
  cardDetails: Array<{
    cardIndex: number;
    position: number;
    reversed: boolean;
  }>;
  metadata: {
    seedUsed: string;
    cardCount: number;
    algorithm: string;
    version: string;
  };
};

export type SettleReadingResult = {
  success: boolean;
  txid: string;
};

/**
 * Composable for hybrid tarot reading.
 */
export function useHybridTarot(
  contractHash: string,
  invokeContract: (params: {
    scriptHash: string;
    operation: string;
    args: Array<{ type: string; value: string | number | boolean }>;
  }) => Promise<{ txid: string }>,
  waitForEvent: (txid: string, eventName: string) => Promise<{ state: unknown[] } | null>,
  parseStackItem: (item: unknown) => unknown,
  authToken: string
) {
  const { isComputing, computeError, executeHybrid } = useHybridCompute();

  /**
   * Draw tarot cards using hybrid two-phase flow.
   */
  async function drawHybrid(
    userAddress: string,
    question: string,
    spreadType: number,
    category: number,
    receiptId: string
  ): Promise<{
    readingId: string;
    cards: number[];
    cardDetails: CardCalculationResult["cardDetails"];
  }> {
    const result = await executeHybrid<
      InitiateReadingResult,
      CardCalculationResult,
      SettleReadingResult
    >(
      // Phase 1: Initiate reading on-chain
      async () => {
        const tx = await invokeContract({
          scriptHash: contractHash,
          operation: "initiateReading",
          args: [
            { type: "Hash160", value: userAddress },
            { type: "String", value: question.slice(0, 200) },
            { type: "Integer", value: spreadType.toString() },
            { type: "Integer", value: category.toString() },
            { type: "Integer", value: receiptId },
          ],
        });

        const txid = extractTxid(tx);
        const event = await waitForEventByTransaction(tx, "ReadingInitiated", waitForEvent);
        if (!event) throw new Error("Reading initiation failed");

        const values = event.state.map(parseStackItem);
        return {
          readingId: String(values[1] ?? ""),
          seed: String(values[3] ?? ""),
          cardCount: Number(values[2] ?? 3),
          txid,
        };
      },

      // Get compute params from initiate result
      (initResult: InitiateReadingResult): ComputeVerifiedRequest => ({
        app_id: APP_ID,
        contract_hash: contractHash,
        script_name: SCRIPT_NAME,
        seed: initResult.seed,
        input: {
          cardCount: initResult.cardCount,
        },
      }),

      // Phase 3: Settle reading on-chain with script hash verification
      async (initResult, computeResult) => {
        // Get script hash from compute response verification
        const scriptHash = (computeResult as unknown as { _verification?: { script_hash: string } })._verification?.script_hash || "";

        const tx = await invokeContract({
          scriptHash: contractHash,
          operation: "settleReading",
          args: [
            { type: "Hash160", value: userAddress },
            { type: "Integer", value: initResult.readingId },
            {
              type: "Array",
              value: computeResult.cards.map((c) => ({
                type: "Integer",
                value: c.toString(),
              })),
            } as unknown as { type: string; value: string },
            { type: "ByteArray", value: scriptHash },
          ],
        });

        const event = await waitForEventByTransaction(tx, "ReadingCompleted", waitForEvent);
        return {
          success: !!event,
          txid: extractTxid(tx),
        };
      },

      authToken
    );

    return {
      readingId: result.initResult.readingId,
      cards: result.computeResult.cards,
      cardDetails: result.computeResult.cardDetails,
    };
  }

  return {
    isComputing,
    computeError,
    drawHybrid,
  };
}
