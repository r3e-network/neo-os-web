import type { NextApiRequest, NextApiResponse } from "next";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { MAINNET_MAGIC } from "@/lib/neo-network";
import {
  enforcePerUserLimit,
  releaseGlobalDailyBudget,
  reserveGlobalDailyBudget,
} from "@/lib/sponsor-quota";
import { tx, wallet } from "@r3e/neo-js-sdk/browser";

function getSponsorConfig() {
  return {
    sponsoredWIF: process.env.SPONSORED_WIF || "",
    // Neo N3 TestNet T5 network magic
    networkMagic: parseInt(
      process.env.NEXT_PUBLIC_NETWORK_MAGIC || "894710606",
      10,
    ),
    // Mainnet sponsorship is disabled unless explicitly opted into. This guards
    // the sponsor wallet's real funds against accidental/abusive mainnet drain.
    allowMainnet: String(process.env.SPONSOR_ALLOW_MAINNET || "").trim() === "true",
  };
}

const MAX_GAS_PER_TX = 0.5; // 0.5 GAS limit per transaction
const MAX_GAS_PER_DAY = 50; // Total global daily limit (GAS), enforced via shared store
const MAX_TX_PER_USER_PER_HOUR = 5;
const PER_USER_WINDOW_SECONDS = 3600; // 1 hour

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
  sign: (
    signingKey: string | { privateKey: string },
    networkMagic: number,
  ) => void;
};

const normalizeAccount = (account: unknown): string => String(account ?? "");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const { sponsoredWIF, networkMagic, allowMainnet } = getSponsorConfig();
  if (!sponsoredWIF) {
    return apiError.internal(res, "Sponsorship is not configured");
  }

  // Refuse to sponsor on mainnet unless explicitly opted in. Sponsoring spends
  // the sponsor wallet's real funds, so mainnet is gated behind a deliberate flag.
  if (networkMagic === MAINNET_MAGIC && !allowMainnet) {
    return apiError.forbidden(
      res,
      "Sponsorship is disabled on mainnet",
    );
  }

  try {
    const authenticatedWallet = await requireWalletAuth(req, res);
    if (!authenticatedWallet) return; // requireWalletAuth already sent the error response

    const { txBase64, userAddress } = req.body;
    if (!txBase64 || !userAddress) {
      return apiError.badRequest(res, "txBase64 and userAddress required");
    }

    if (authenticatedWallet !== userAddress) {
      return apiError.unauthorized(
        res,
        "Authenticated wallet does not match requested sponsor address",
      );
    }

    const sponsorAccount = new wallet.Account(sponsoredWIF);
    const transaction = tx.Transaction.deserialize(
      txBase64,
    ) as SponsorTransaction;

    const userSignerIndex = transaction.signers.findIndex(
      (signer) =>
        wallet.getAddressFromScriptHash(normalizeAccount(signer.account)) ===
        userAddress,
    );
    if (userSignerIndex < 0) {
      return apiError.badRequest(
        res,
        "Transaction does not belong to the user",
      );
    }

    const userWitness = transaction.witnesses?.[userSignerIndex];
    if (
      !userWitness?.invocationScript ||
      String(userWitness.invocationScript).length === 0
    ) {
      return apiError.badRequest(
        res,
        "Transaction must include a signed user witness",
      );
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

    const sizingTransaction = tx.Transaction.deserialize(
      transaction.serialize(true),
    ) as SponsorTransaction;
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
    const calculatedFee = size * feePerByte + 100000;

    const requestedFeeGas = calculatedFee / 100000000;

    if (requestedFeeGas > MAX_GAS_PER_TX) {
      return apiError.badRequest(
        res,
        `Transaction fee exceeds maximum sponsored amount (${MAX_GAS_PER_TX} GAS)`,
      );
    }

    // Reserve this request's fee against the shared global daily budget BEFORE
    // signing. The reservation is atomic across all serverless instances and
    // fails closed when the store is unavailable.
    const globalReservation = await reserveGlobalDailyBudget({
      amountGas: requestedFeeGas,
      dailyLimitGas: MAX_GAS_PER_DAY,
    });
    if (!globalReservation.allowed) {
      return sendError(
        res,
        globalReservation.status,
        globalReservation.reason,
        globalReservation.status === 429
          ? ErrorCodes.RATE_LIMITED
          : ErrorCodes.INTERNAL_ERROR,
      );
    }

    // Enforce the per-user rolling-window limit. If it denies (or the store is
    // unavailable), release the global reservation we just took.
    const perUserCheck = await enforcePerUserLimit({
      userAddress,
      maxPerWindow: MAX_TX_PER_USER_PER_HOUR,
      windowSeconds: PER_USER_WINDOW_SECONDS,
    });
    if (!perUserCheck.allowed) {
      await releaseGlobalDailyBudget(requestedFeeGas);
      return sendError(
        res,
        perUserCheck.status,
        perUserCheck.reason,
        perUserCheck.status === 429
          ? ErrorCodes.RATE_LIMITED
          : ErrorCodes.INTERNAL_ERROR,
      );
    }

    try {
      transaction.networkFee = BigInt(Math.floor(calculatedFee));
      transaction.sign(sponsoredWIF, networkMagic);
    } catch (signError) {
      // Signing failed: release the reserved global budget so it isn't stranded.
      await releaseGlobalDailyBudget(requestedFeeGas);
      throw signError;
    }

    res.status(200).json({
      success: true,
      sponsoredTxBase64: transaction.serialize(true),
      witnesses: transaction.witnesses.map((witness) =>
        typeof witness?.toJSON === "function" ? witness.toJSON() : witness,
      ),
    });
    return;
  } catch (error) {
    logger.error(
      "Sponsor API error:",
      error instanceof Error ? error.message : "unknown",
    );
    return apiError.internal(res, "Failed to sponsor transaction");
  }
}
