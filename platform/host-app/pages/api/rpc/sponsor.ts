import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { tx, wallet, rpc, u } from "@cityofzion/neon-js";

const SPONSORED_WIF = process.env.SPONSORED_WIF || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = parseInt(process.env.NEXT_PUBLIC_NETWORK_MAGIC || "877933390", 10);

const MAX_GAS_PER_TX = 0.5; // 0.5 GAS limit per transaction
const MAX_GAS_PER_DAY = 50; // Total global daily limit
const MAX_TX_PER_USER_PER_HOUR = 5;

// In-memory rate limit store
const sponsorStats = {
  dailyGasSpent: 0,
  lastResetDay: new Date().getUTCDate(),
  userTxCounts: new Map<string, { count: number; hour: number }>(),
};

function resetStatsIfNeeded() {
  const currentDay = new Date().getUTCDate();
  if (sponsorStats.lastResetDay !== currentDay) {
    sponsorStats.dailyGasSpent = 0;
    sponsorStats.lastResetDay = currentDay;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  if (!SPONSORED_WIF) {
    return apiError.internal(res, "Sponsorship is not configured");
  }

  try {
    const { txBase64, userAddress } = req.body;
    if (!txBase64 || !userAddress) {
      return apiError.badRequest(res, "txBase64 and userAddress required");
    }

    resetStatsIfNeeded();

    // Check Global Limit
    if (sponsorStats.dailyGasSpent >= MAX_GAS_PER_DAY) {
      return apiError.rateLimited(res, "Global daily sponsorship limit reached");
    }

    // Check User Limit
    const currentHour = new Date().getUTCHours();
    const userStats = sponsorStats.userTxCounts.get(userAddress) || { count: 0, hour: currentHour };
    
    if (userStats.hour !== currentHour) {
      userStats.count = 0;
      userStats.hour = currentHour;
    }
    
    if (userStats.count >= MAX_TX_PER_USER_PER_HOUR) {
      return apiError.rateLimited(res, "User hourly sponsorship limit reached");
    }

    const sponsorAccount = new wallet.Account(SPONSORED_WIF);
    const transaction = tx.Transaction.deserialize(txBase64);

    // Validate if the user is one of the signers
    const hasUserSigner = transaction.signers.some(s => wallet.getAddressFromScriptHash(s.account.toString()) === userAddress);
    if (!hasUserSigner) {
      return apiError.badRequest(res, "Transaction does not belong to the user");
    }

    // Add Sponsor as a signer if not already present
    const sponsorScriptHash = sponsorAccount.scriptHash;
    const hasSponsorSigner = transaction.signers.some(s => s.account.toString() === sponsorScriptHash);
    
    if (!hasSponsorSigner) {
      transaction.signers.push(new tx.Signer({
        account: sponsorAccount.scriptHash,
        scopes: tx.WitnessScope.None, // Only used for fee payment
      }));
    }

    // Recalculate Network Fee (assuming standard 1000 fee per byte for N3)
    const feePerByte = 1000;
    
    // Create dummy witnesses for size calculation
    const dummySignatures = transaction.signers.map(signer => {
      if (signer.account.toString() === sponsorAccount.scriptHash) {
        return new tx.Witness({
          invocationScript: "0c40" + "00".repeat(64),
          verificationScript: "21" + sponsorAccount.publicKey + "ac",
        });
      }
      return new tx.Witness({ invocationScript: "", verificationScript: "" });
    });
    
    const size = transaction.serialize().length / 2 + dummySignatures.reduce((acc, sig) => acc + sig.serialize().length / 2, 0);
    const calculatedFee = (size * feePerByte) + 100000; // Adding buffer

    const requestedFeeGas = calculatedFee / 100000000;

    if (requestedFeeGas > MAX_GAS_PER_TX) {
      return apiError.badRequest(res, `Transaction fee exceeds maximum sponsored amount (${MAX_GAS_PER_TX} GAS)`);
    }

    // Set the fee and sign
    transaction.networkFee = u.BigInteger.fromNumber(Math.floor(calculatedFee));
    transaction.sign(sponsorAccount, NETWORK_MAGIC);
    
    // Track usage
    sponsorStats.dailyGasSpent += requestedFeeGas;
    userStats.count += 1;
    sponsorStats.userTxCounts.set(userAddress, userStats);

    return res.status(200).json({
      success: true,
      sponsoredTxBase64: transaction.serialize(true),
      witnesses: transaction.witnesses.map(w => w.serialize()),
    });

  } catch (error) {
    logger.error("Sponsor API error:", error instanceof Error ? error.message : "unknown");
    return apiError.internal(res, "Failed to sponsor transaction");
  }
}
