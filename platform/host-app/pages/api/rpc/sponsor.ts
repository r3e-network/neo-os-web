import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { tx, wallet } from "@r3e/neo-js-sdk/browser";

function getSponsorConfig() {
  return {
    sponsoredWIF: process.env.SPONSORED_WIF || "",
    networkMagic: parseInt(process.env.NEXT_PUBLIC_NETWORK_MAGIC || "877933390", 10),
  };
}

const MAX_GAS_PER_TX = 0.5; // 0.5 GAS limit per transaction
const MAX_GAS_PER_DAY = 50; // Total global daily limit
const MAX_TX_PER_USER_PER_HOUR = 5;

const sponsorStats = {
  dailyGasSpent: 0,
  lastResetDay: new Date().getUTCDate(),
  userTxCounts: new Map<string, { count: number; hour: number }>(),
};

type SponsorSigner = {
  account: string;
  scopes?: unknown;
};

type SponsorWitnessLike = {
  invocationScript?: string;
  verificationScript?: string;
  toJSON?: () => unknown;
};

type SponsorTransaction = {
  signers: SponsorSigner[];
  witnesses: SponsorWitnessLike[];
  networkFee: bigint | number;
  serialize: (signed?: boolean) => string;
  sign: (signingKey: string | { privateKey: string }, networkMagic: number) => void;
};

const normalizeAccount = (account: unknown): string => String(account ?? "");

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

  const { sponsoredWIF, networkMagic } = getSponsorConfig();
  if (!sponsoredWIF) {
    return apiError.internal(res, "Sponsorship is not configured");
  }

  try {
    const { txBase64, userAddress } = req.body;
    if (!txBase64 || !userAddress) {
      return apiError.badRequest(res, "txBase64 and userAddress required");
    }

    resetStatsIfNeeded();

    if (sponsorStats.dailyGasSpent >= MAX_GAS_PER_DAY) {
      return apiError.rateLimited(res, "Global daily sponsorship limit reached");
    }

    const currentHour = new Date().getUTCHours();
    const userStats = sponsorStats.userTxCounts.get(userAddress) || { count: 0, hour: currentHour };

    if (userStats.hour !== currentHour) {
      userStats.count = 0;
      userStats.hour = currentHour;
    }

    if (userStats.count >= MAX_TX_PER_USER_PER_HOUR) {
      return apiError.rateLimited(res, "User hourly sponsorship limit reached");
    }

    const sponsorAccount = new wallet.Account(sponsoredWIF);
    const transaction = tx.Transaction.deserialize(txBase64) as SponsorTransaction;

    const hasUserSigner = transaction.signers.some(
      (signer) => wallet.getAddressFromScriptHash(normalizeAccount(signer.account)) === userAddress,
    );
    if (!hasUserSigner) {
      return apiError.badRequest(res, "Transaction does not belong to the user");
    }

    const sponsorScriptHash = sponsorAccount.scriptHash;
    const hasSponsorSigner = transaction.signers.some(
      (signer) => normalizeAccount(signer.account) === sponsorScriptHash,
    );

    if (!hasSponsorSigner) {
      transaction.signers.push({
        account: sponsorAccount.scriptHash,
        scopes: tx.WitnessScope.None,
      });
    }

    const feePerByte = 1000;
    const sponsorVerificationScript = sponsorAccount.contract?.script
      ? Buffer.from(sponsorAccount.contract.script, "base64").toString("hex")
      : `21${String(sponsorAccount.publicKey)}ac`;

    const sizingTransaction = tx.Transaction.deserialize(transaction.serialize(true)) as SponsorTransaction;
    sizingTransaction.signers = [...transaction.signers];
    sizingTransaction.witnesses = transaction.signers.map((signer) =>
      normalizeAccount(signer.account) === sponsorAccount.scriptHash
        ? new tx.Witness({
            invocationScript: `0c40${"00".repeat(64)}`,
            verificationScript: sponsorVerificationScript,
          })
        : new tx.Witness({
            invocationScript: "",
            verificationScript: "",
          }),
    );

    const size = sizingTransaction.serialize(true).length / 2;
    const calculatedFee = (size * feePerByte) + 100000;

    const requestedFeeGas = calculatedFee / 100000000;

    if (requestedFeeGas > MAX_GAS_PER_TX) {
      return apiError.badRequest(res, `Transaction fee exceeds maximum sponsored amount (${MAX_GAS_PER_TX} GAS)`);
    }

    transaction.networkFee = BigInt(Math.floor(calculatedFee));
    transaction.sign(sponsoredWIF, networkMagic);

    sponsorStats.dailyGasSpent += requestedFeeGas;
    userStats.count += 1;
    sponsorStats.userTxCounts.set(userAddress, userStats);

    return res.status(200).json({
      success: true,
      sponsoredTxBase64: transaction.serialize(true),
      witnesses: transaction.witnesses.map((witness) =>
        typeof witness?.toJSON === "function" ? witness.toJSON() : witness,
      ),
    });
  } catch (error) {
    logger.error("Sponsor API error:", error instanceof Error ? error.message : "unknown");
    return apiError.internal(res, "Failed to sponsor transaction");
  }
}
