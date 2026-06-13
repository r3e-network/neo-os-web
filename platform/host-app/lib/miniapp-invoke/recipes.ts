import {
  BLOCKCHAIN_CONSTANTS,
  EXTERNAL_INTEGRATIONS,
} from "../../../../apps/shared/constants";
import {
  buildInvokeArgs,
  parseScaledDecimal,
  resolveNetworkOperationMethod,
} from "../miniapp-detail-helpers";
import {
  DAILY_CHECKIN_APP_ID,
  DAILY_CHECKIN_FEE_FIXED8,
  DAILY_CHECKIN_MEMO,
  DEV_TIPPING_APP_ID,
  DEV_TIPPING_MIN_TIP_FIXED8,
  DEV_TIPPING_TIP_MEMO,
  FUND_GAME_CREDIT_MEMO_BY_APP,
  GRAVEYARD_APP_ID,
  GRAVEYARD_BURY_MEMO,
  GRAVEYARD_DEFAULT_BURY_FEE_FIXED8,
  GRAVEYARD_DEFAULT_FORGET_FEE_FIXED8,
  GRAVEYARD_FORGET_MEMO,
  MEMORIAL_SHRINE_APP_ID,
  MEMORIAL_SHRINE_OFFERING_COSTS_FIXED8,
  MEMORIAL_SHRINE_TRIBUTE_MEMO,
  NEO_PAY_APP_ID,
  RECOVERY_GUARDIAN_APP_ID,
  RED_ENVELOPE_APP_ID,
  RED_ENVELOPE_CREATE_MEMO,
  SELF_LOAN_APP_ID,
  SELF_LOAN_COLLATERAL_MEMO,
  SELF_LOAN_POOL_MEMO,
  SELF_LOAN_REPAY_MEMO,
  TIME_CAPSULE_APP_ID,
  TIME_CAPSULE_DEFAULT_SEAL_FEE_FIXED8,
  TIME_CAPSULE_SEAL_MEMO,
  UNBREAKABLE_VAULT_APP_ID,
  UNBREAKABLE_VAULT_ATTEMPT_MEMO,
  UNBREAKABLE_VAULT_CREATE_MEMO,
  UNBREAKABLE_VAULT_DEFAULT_ATTEMPT_FEE_FIXED8,
  UNBREAKABLE_VAULT_INCREASE_MEMO,
  UNBREAKABLE_VAULT_MIN_BOUNTY_FIXED8,
} from "./constants";
import type {
  InvokeRecipe,
  InvokeRecipeInvocation,
} from "./executor";
import { fundedRecipe, simpleRecipe } from "./recipe-factories";
import { readNeoInteger } from "./neo-read";
import {
  accountIdByteArrayValue,
  boundedTextValue,
  booleanOperationValue,
  buildInvokeArgsWithoutParams,
  cleanValue,
  formatFixed8Amount,
  futureUnlockTimeMsValue,
  hash160OperationValue,
  hash160ToLittleEndianBase64,
  hexToBase64,
  integerRangeValue,
  normalizeHostHash160Value,
  normalizedSha256Hash,
  normalizedSha256HashValue,
  optionalIntegerRangeValue,
  optionalPositiveFixed8Value,
  optionalPositiveWholeValue,
  optionalVaultReceiptId,
  positiveWholeValue,
  recoveryEncryptedParamsValue,
  recoveryExpiresAtText,
  recoveryProviderValue,
  utf8ToBase64,
} from "./values";

function gasTransfer(
  walletAddress: string,
  targetHash: string,
  amountFixed8: string,
  memo: string,
): InvokeRecipeInvocation {
  return {
    scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    operation: "transfer",
    args: [
      { type: "Hash160", value: walletAddress },
      { type: "Hash160", value: targetHash },
      { type: "Integer", value: amountFixed8 },
      { type: "String", value: memo },
    ],
  };
}

function neoTransfer(
  walletAddress: string,
  targetHash: string,
  amountInteger: string,
  memo: string,
): InvokeRecipeInvocation {
  return {
    scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
    operation: "transfer",
    args: [
      { type: "Hash160", value: walletAddress },
      { type: "Hash160", value: targetHash },
      { type: "Integer", value: amountInteger },
      { type: "String", value: memo },
    ],
  };
}

function recoveryAccountRecipe(label: string): InvokeRecipe {
  return simpleRecipe(
    "Recovery Guardian verifier",
    ({ operation, values, walletAddress, targetHash }) => ({
      invocation: {
        scriptHash: targetHash,
        operation: operation.method,
        args: [
          {
            type: "ByteArray",
            value: accountIdByteArrayValue(
              values,
              ["accountId", "account", "accountAddress"],
              "AA account ID",
            ),
          },
        ],
      },
      successMessage: (txid) => `${label}: ${txid}`,
    }),
  );
}

/**
 * Per-app invoke recipes keyed by `"appId:method"`. Wildcard entries keyed
 * `"*:method"` apply to every miniapp that exposes the method. Each recipe is
 * executed through the single executor in ./executor.ts.
 */
export const MINIAPP_INVOKE_RECIPES: Record<string, InvokeRecipe> = {
  [`${DEV_TIPPING_APP_ID}:sendTip`]: fundedRecipe(
    "Dev Tipping contract",
    "funded tip transaction",
    ({ values, walletAddress, targetHash }) => {
      const devId = positiveWholeValue(
        values,
        ["devId", "developerId", "id"],
        "Developer ID",
      );
      const amount = optionalPositiveFixed8Value(
        values,
        ["amount", "tipAmount"],
        "Tip amount",
      );
      if (!amount || BigInt(amount) < DEV_TIPPING_MIN_TIP_FIXED8) {
        throw new Error("Minimum tip is 0.001 GAS.");
      }
      const message = cleanValue(values, ["message", "note"]).trim();
      if (message.length > 280) {
        throw new Error("Message must be 280 characters or fewer.");
      }
      const tipperName =
        cleanValue(values, ["tipperName", "from", "name"]).trim() ||
        "Neo supporter";
      if (tipperName.length > 64) {
        throw new Error("Tipper name must be 64 characters or fewer.");
      }
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, amount, DEV_TIPPING_TIP_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "tip",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "Integer", value: devId },
            { type: "Integer", value: amount },
            { type: "String", value: message },
            { type: "String", value: tipperName },
          ],
        },
        successMessage: (txid) => `Tip sent: ${txid}`,
      };
    },
  ),

  [`${MEMORIAL_SHRINE_APP_ID}:createMemorial`]: simpleRecipe(
    "Memorial Shrine contract",
    ({ values, walletAddress, targetHash }) => {
      const name = boundedTextValue(
        values,
        ["name", "memorialName", "deceasedName"],
        "Memorial name",
        96,
        true,
      );
      const photoHash = boundedTextValue(
        values,
        ["photoHash", "photo", "image"],
        "Photo hash",
        160,
      );
      const relationship = boundedTextValue(
        values,
        ["relationship", "relation"],
        "Relationship",
        64,
      );
      const birthYear = optionalIntegerRangeValue(
        values,
        ["birthYear", "birth"],
        "Birth year",
        0,
        9999,
      );
      const deathYear = optionalIntegerRangeValue(
        values,
        ["deathYear", "death"],
        "Death year",
        0,
        9999,
      );
      const biography = boundedTextValue(
        values,
        ["biography", "bio"],
        "Biography",
        600,
      );
      const obituary = boundedTextValue(values, ["obituary"], "Obituary", 600);
      return {
        invocation: {
          scriptHash: targetHash,
          operation: "createMemorial",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "String", value: name },
            { type: "String", value: photoHash },
            { type: "String", value: relationship },
            { type: "Integer", value: birthYear },
            { type: "Integer", value: deathYear },
            { type: "String", value: biography },
            { type: "String", value: obituary },
          ],
        },
        successMessage: (txid) => `Memorial created: ${txid}`,
      };
    },
  ),

  [`${MEMORIAL_SHRINE_APP_ID}:payTribute`]: fundedRecipe(
    "Memorial Shrine contract",
    "funded tribute transaction",
    ({ values, walletAddress, targetHash, targetNetwork }) => {
      const memorialId = positiveWholeValue(
        values,
        ["memorialId", "id"],
        "Memorial ID",
      );
      const offeringType = integerRangeValue(
        values,
        ["offeringType", "offering"],
        "Offering",
        1,
        6,
      );
      const amount = MEMORIAL_SHRINE_OFFERING_COSTS_FIXED8[offeringType];
      if (!amount) {
        throw new Error("Offering is not configured.");
      }
      const message = boundedTextValue(
        values,
        ["message", "tributeMessage", "note"],
        "Tribute message",
        280,
      );
      const receiptId = optionalPositiveWholeValue(
        values,
        ["receiptId", "paymentReceiptId"],
        "Payment receipt ID",
      );
      if (targetNetwork === "mainnet") {
        if (!receiptId) {
          throw new Error(
            "Mainnet Memorial Shrine tribute requires a payment receipt ID. Use testnet for the direct funded flow or enter an existing payment receipt ID.",
          );
        }
        return {
          invocation: {
            scriptHash: targetHash,
            operation: "payTribute",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Integer", value: memorialId },
              { type: "Integer", value: offeringType },
              { type: "String", value: message },
              { type: "Integer", value: receiptId },
            ],
          },
          successMessage: (txid) => `Tribute paid: ${txid}`,
        };
      }
      return {
        deposits: [
          gasTransfer(
            walletAddress,
            targetHash,
            amount,
            `${MEMORIAL_SHRINE_TRIBUTE_MEMO}:${memorialId}:${offeringType}`,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "payTribute",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "Integer", value: memorialId },
            { type: "Integer", value: offeringType },
            { type: "String", value: message },
          ],
        },
        successMessage: (txid) => `Tribute paid: ${txid}`,
      };
    },
  ),

  [`${RECOVERY_GUARDIAN_APP_ID}:requestRecoveryTicket`]: simpleRecipe(
    "Recovery Guardian verifier",
    ({ values, walletAddress, targetHash }) => {
      const accountId = accountIdByteArrayValue(
        values,
        ["accountId", "account", "accountAddress"],
        "AA account ID",
      );
      const newOwner = hash160OperationValue(
        values,
        ["newOwner", "owner", "recoveryNewOwner"],
        "New owner",
        walletAddress,
      );
      const walletHash = normalizeHostHash160Value(
        walletAddress,
        "Connected wallet",
      );
      if (newOwner !== walletHash) {
        throw new Error(
          "New owner must match the connected wallet for the verifier witness check.",
        );
      }
      return {
        invocation: {
          scriptHash: targetHash,
          operation: "requestRecoveryTicket",
          args: [
            { type: "ByteArray", value: accountId },
            { type: "String", value: recoveryProviderValue(values) },
            { type: "Hash160", value: newOwner },
            { type: "String", value: recoveryExpiresAtText(values) },
            { type: "String", value: recoveryEncryptedParamsValue(values) },
          ],
        },
        successMessage: (txid) => `Recovery ticket requested: ${txid}`,
      };
    },
  ),

  [`${RECOVERY_GUARDIAN_APP_ID}:cancelRecovery`]:
    recoveryAccountRecipe("Recovery cancelled"),

  [`${RECOVERY_GUARDIAN_APP_ID}:finalizeRecovery`]:
    recoveryAccountRecipe("Recovery finalized"),

  [`${TIME_CAPSULE_APP_ID}:sealCapsule`]: fundedRecipe(
    "Time Capsule contract",
    "funded capsule transaction",
    ({ values, walletAddress, targetHash }) => {
      const contentHash = normalizedSha256Hash(values, [
        "contentHash",
        "messageHash",
        "hash",
      ]);
      const title = cleanValue(values, ["title", "capsuleTitle"]).trim();
      if (!title) {
        throw new Error("Capsule title is required.");
      }
      if (title.length > 100) {
        throw new Error("Capsule title must be 100 characters or fewer.");
      }
      const unlockTimeMs = futureUnlockTimeMsValue(values);
      const isPublic = booleanOperationValue(
        values,
        ["isPublic", "public", "visibility"],
        "Public visibility",
        false,
      );
      const category = integerRangeValue(values, ["category"], "Category", 1, 5);
      const feeAmount =
        optionalPositiveFixed8Value(
          values,
          ["sealFeeGas", "feeGas", "amount"],
          "Seal fee",
        ) ?? TIME_CAPSULE_DEFAULT_SEAL_FEE_FIXED8;
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, feeAmount, TIME_CAPSULE_SEAL_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "bury",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "String", value: contentHash },
            { type: "String", value: title },
            { type: "Integer", value: unlockTimeMs },
            { type: "Boolean", value: isPublic },
            { type: "Integer", value: category },
          ],
        },
        successMessage: (txid) => `Capsule sealed: ${txid}`,
      };
    },
  ),

  [`${UNBREAKABLE_VAULT_APP_ID}:createVault`]: fundedRecipe(
    "Unbreakable Vault contract",
    "funded vault transaction",
    ({ values, walletAddress, targetHash, targetNetwork }) => {
      const bountyAmount = optionalPositiveFixed8Value(
        values,
        ["bountyGas", "bounty", "amount"],
        "Bounty",
      );
      if (
        !bountyAmount ||
        BigInt(bountyAmount) < UNBREAKABLE_VAULT_MIN_BOUNTY_FIXED8
      ) {
        throw new Error("Minimum vault bounty is 1 GAS.");
      }
      const secretHash = normalizedSha256HashValue(
        values,
        ["secretHash", "hash"],
        "Secret hash",
      );
      const title = cleanValue(values, ["title", "vaultTitle"]).trim();
      if (!title) {
        throw new Error("Vault title is required.");
      }
      if (title.length > 100) {
        throw new Error("Vault title must be 100 characters or fewer.");
      }
      const description = cleanValue(values, [
        "description",
        "vaultDescription",
        "hint",
      ]).trim();
      if (description.length > 300) {
        throw new Error("Vault description must be 300 characters or fewer.");
      }
      const difficulty = integerRangeValue(
        values,
        ["difficulty"],
        "Difficulty",
        1,
        3,
      );
      const receiptId = optionalVaultReceiptId(values, targetNetwork);
      const createVaultArgs: Array<{ type: string; value: unknown }> = [
        { type: "Hash160", value: walletAddress },
        { type: "ByteArray", value: hexToBase64(secretHash) },
        { type: "Integer", value: bountyAmount },
        { type: "Integer", value: difficulty },
        { type: "String", value: title },
        { type: "String", value: description },
      ];
      if (receiptId) {
        createVaultArgs.push({ type: "Integer", value: receiptId });
      }
      return {
        deposits: [
          gasTransfer(
            walletAddress,
            targetHash,
            bountyAmount,
            UNBREAKABLE_VAULT_CREATE_MEMO,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "createVault",
          args: createVaultArgs,
        },
        successMessage: (txid) => `Vault created: ${txid}`,
      };
    },
  ),

  [`${UNBREAKABLE_VAULT_APP_ID}:attemptBreak`]: fundedRecipe(
    "Unbreakable Vault contract",
    "funded break attempt",
    ({ values, walletAddress, targetHash, targetNetwork }) => {
      const vaultId = positiveWholeValue(values, ["vaultId", "id"], "Vault ID");
      const secret = cleanValue(values, [
        "secret",
        "attemptSecret",
        "guess",
      ]).trim();
      if (!secret) {
        throw new Error("Break secret is required.");
      }
      const feeAmount =
        optionalPositiveFixed8Value(
          values,
          ["attemptFeeGas", "feeGas", "amount"],
          "Attempt fee",
        ) ?? UNBREAKABLE_VAULT_DEFAULT_ATTEMPT_FEE_FIXED8;
      const receiptId = optionalVaultReceiptId(values, targetNetwork);
      const attemptArgs: Array<{ type: string; value: unknown }> = [
        { type: "Integer", value: vaultId },
        { type: "Hash160", value: walletAddress },
        { type: "ByteArray", value: utf8ToBase64(secret) },
      ];
      if (receiptId) {
        attemptArgs.push({ type: "Integer", value: receiptId });
      }
      return {
        deposits: [
          gasTransfer(
            walletAddress,
            targetHash,
            feeAmount,
            UNBREAKABLE_VAULT_ATTEMPT_MEMO,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "attemptBreak",
          args: attemptArgs,
        },
        successMessage: (txid) => `Break attempt submitted: ${txid}`,
      };
    },
  ),

  [`${UNBREAKABLE_VAULT_APP_ID}:increaseBounty`]: fundedRecipe(
    "Unbreakable Vault contract",
    "funded bounty increase",
    ({ values, walletAddress, targetHash, targetNetwork }) => {
      const vaultId = positiveWholeValue(values, ["vaultId", "id"], "Vault ID");
      const amount = optionalPositiveFixed8Value(
        values,
        ["bountyGas", "amount", "topupGas"],
        "Bounty top-up",
      );
      if (!amount) {
        throw new Error("Bounty top-up must be a positive GAS value.");
      }
      const receiptId = optionalVaultReceiptId(values, targetNetwork);
      const increaseArgs: Array<{ type: string; value: unknown }> = [
        { type: "Integer", value: vaultId },
        { type: "Integer", value: amount },
      ];
      if (receiptId) {
        increaseArgs.push({ type: "Integer", value: receiptId });
      }
      return {
        deposits: [
          gasTransfer(
            walletAddress,
            targetHash,
            amount,
            UNBREAKABLE_VAULT_INCREASE_MEMO,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "increaseBounty",
          args: increaseArgs,
        },
        successMessage: (txid) => `Bounty increased: ${txid}`,
      };
    },
  ),

  [`${UNBREAKABLE_VAULT_APP_ID}:claimExpiredVault`]: simpleRecipe(
    "Unbreakable Vault contract",
    ({ values, targetHash }) => {
      const vaultId = positiveWholeValue(values, ["vaultId", "id"], "Vault ID");
      return {
        invocation: {
          scriptHash: targetHash,
          operation: "claimExpiredVault",
          args: [{ type: "Integer", value: vaultId }],
        },
        successMessage: (txid) => `Expired vault claimed: ${txid}`,
      };
    },
  ),

  "*:fundOracleRequestFee": simpleRecipe(
    "Game contract",
    async ({ walletAddress, targetHash, targetNetwork }) => {
      const oracleHash =
        EXTERNAL_INTEGRATIONS[targetNetwork].contracts.morpheusOracle;
      if (!oracleHash) {
        throw new Error(
          "Morpheus Oracle contract is not configured for this network.",
        );
      }
      const [requestFee, feeCredit] = await Promise.all([
        readNeoInteger({
          contractHash: oracleHash,
          method: "requestFee",
          params: [],
          network: targetNetwork,
          label: "Oracle request fee",
        }),
        readNeoInteger({
          contractHash: oracleHash,
          method: "feeCreditOf",
          params: [{ type: "Hash160", value: targetHash }],
          network: targetNetwork,
          label: "Oracle fee credit",
        }),
      ]);
      const missingFee = requestFee > feeCredit ? requestFee - feeCredit : 0n;
      if (missingFee <= 0n) {
        return { completedMessage: "Oracle request fee is already funded." };
      }
      return {
        invocation: {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "Hash160", value: oracleHash },
            { type: "Integer", value: missingFee.toString() },
            {
              type: "ByteArray",
              value: hash160ToLittleEndianBase64(targetHash),
            },
          ],
        },
        successMessage: (txid) =>
          `Oracle fee funded: ${txid} (${formatFixed8Amount(missingFee)} GAS)`,
      };
    },
  ),

  "*:fundGameCredit": simpleRecipe(
    "Game contract",
    ({ appId, values, walletAddress, targetHash }) => {
      const amountText = String(values.amount || "").trim();
      if (!/^\d+(?:\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
        throw new Error("Funding amount must be a positive GAS value.");
      }
      const amount = parseScaledDecimal(amountText, 8, "Funding amount");
      return {
        invocation: gasTransfer(
          walletAddress,
          targetHash,
          amount,
          FUND_GAME_CREDIT_MEMO_BY_APP[appId] || `${appId}:credit`,
        ),
        successMessage: (txid) => `Game credit funded: ${txid}`,
      };
    },
  ),

  [`${RED_ENVELOPE_APP_ID}:createEnvelope`]: fundedRecipe(
    "Red Envelope contract",
    "funded create transaction",
    ({ appId, operation, values, walletAddress, targetHash, targetNetwork }) => {
      const amountText = String(values.amount || "").trim();
      if (!/^\d+(?:\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
        throw new Error("Envelope amount must be a positive GAS value.");
      }
      const packetCount = String(values.packetCount || "").trim();
      if (!/^[1-9]\d*$/.test(packetCount)) {
        throw new Error("Recipients must be a positive integer.");
      }
      const expirySeconds = String(
        values.expirySeconds || values.expiry || "",
      ).trim();
      if (!/^[1-9]\d*$/.test(expirySeconds)) {
        throw new Error("Expiry must be a positive number of seconds.");
      }
      const amount = parseScaledDecimal(amountText, 8, "Envelope amount");
      const expiryMs = (BigInt(expirySeconds) * 1000n).toString();
      const args = buildInvokeArgs(
        operation.params ?? [],
        { ...values, expirySeconds: expiryMs },
        walletAddress,
      );
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, amount, RED_ENVELOPE_CREATE_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: resolveNetworkOperationMethod(
            appId,
            operation.method,
            targetNetwork,
          ),
          args,
        },
        successMessage: (txid) => `Envelope created: ${txid}`,
      };
    },
  ),

  [`${NEO_PAY_APP_ID}:createStream`]: fundedRecipe(
    "NeoPay contract",
    "funded stream transaction",
    ({ appId, operation, values, walletAddress, targetHash, targetNetwork }) => {
      const totalAmountText = String(values.totalAmount || "").trim();
      if (
        !/^\d+(?:\.\d+)?$/.test(totalAmountText) ||
        Number(totalAmountText) <= 0
      ) {
        throw new Error("Total GAS must be a positive value.");
      }
      const rateAmountText = String(values.rateAmount || "").trim();
      if (
        !/^\d+(?:\.\d+)?$/.test(rateAmountText) ||
        Number(rateAmountText) <= 0
      ) {
        throw new Error("Daily release must be a positive GAS value.");
      }
      const intervalSeconds = String(values.intervalSeconds || "").trim();
      if (!/^[1-9]\d*$/.test(intervalSeconds)) {
        throw new Error("Interval must be a positive number of seconds.");
      }
      const totalAmount = parseScaledDecimal(totalAmountText, 8, "Total GAS");
      const rateAmount = parseScaledDecimal(rateAmountText, 8, "Daily release");
      if (BigInt(rateAmount) > BigInt(totalAmount)) {
        throw new Error("Daily release cannot exceed total GAS.");
      }
      const args = buildInvokeArgs(
        operation.params ?? [],
        {
          ...values,
          creator: "$wallet",
          asset: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          totalAmount: totalAmountText,
          rateAmount: rateAmountText,
          title: String(values.title || "NeoPay stream").trim(),
          notes: String(values.notes || "").trim(),
        },
        walletAddress,
      );
      return {
        deposits: [
          gasTransfer(
            walletAddress,
            targetHash,
            totalAmount,
            `stream:GAS:${totalAmount}`,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: resolveNetworkOperationMethod(
            appId,
            operation.method,
            targetNetwork,
          ),
          args,
        },
        successMessage: (txid) => `Stream created: ${txid}`,
      };
    },
  ),

  [`${SELF_LOAN_APP_ID}:createLoan`]: fundedRecipe(
    "SelfLoan contract",
    "funded loan transaction",
    ({ values, walletAddress, targetHash, targetNetwork }) => {
      const collateralNeo = positiveWholeValue(
        values,
        ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
        "Collateral NEO",
      );
      const ltvTier = integerRangeValue(
        values,
        ["ltvTier", "tier"],
        "LTV tier",
        1,
        3,
      );
      if (targetNetwork === "mainnet") {
        return {
          invocation: {
            scriptHash: targetHash,
            operation: "createLoan",
            args: buildInvokeArgs(
              [
                {
                  name: "borrower",
                  type: "hash160",
                  required: true,
                  default_value: "$wallet",
                },
                {
                  name: "neoAmount",
                  type: "integer",
                  required: true,
                },
                {
                  name: "ltvTier",
                  type: "integer",
                  required: true,
                },
              ],
              { borrower: "$wallet", neoAmount: collateralNeo, ltvTier },
              walletAddress,
            ),
          },
          successMessage: (txid) => `Loan created: ${txid}`,
        };
      }
      const liquidityTopup = optionalPositiveFixed8Value(
        values,
        ["poolTopupGas", "liquidityTopupGas"],
        "Liquidity top-up",
      );
      const borrowerArg = buildInvokeArgs(
        [
          {
            name: "borrower",
            type: "hash160",
            required: true,
            default_value: "$wallet",
          },
        ],
        { borrower: "$wallet" },
        walletAddress,
      )[0];
      const deposits: InvokeRecipeInvocation[] = [];
      if (liquidityTopup) {
        deposits.push(
          gasTransfer(walletAddress, targetHash, liquidityTopup, SELF_LOAN_POOL_MEMO),
        );
      }
      deposits.push(
        neoTransfer(
          walletAddress,
          targetHash,
          collateralNeo,
          SELF_LOAN_COLLATERAL_MEMO,
        ),
      );
      return {
        deposits,
        invocation: {
          scriptHash: targetHash,
          operation: "createLoan",
          args: [
            { type: "String", value: SELF_LOAN_APP_ID },
            borrowerArg,
            { type: "Integer", value: ltvTier },
          ],
        },
        successMessage: (txid) => `Loan created: ${txid}`,
      };
    },
  ),

  [`${SELF_LOAN_APP_ID}:repayLoan`]: fundedRecipe(
    "SelfLoan contract",
    "funded repayment transaction",
    ({ operation, values, walletAddress, targetHash, targetNetwork }) => {
      const repayGas = optionalPositiveFixed8Value(
        values,
        ["repayGas", "amount", "repayAmount"],
        "Repay amount",
      );
      if (!repayGas) {
        throw new Error("Repay amount must be a positive GAS value.");
      }
      if (targetNetwork === "mainnet") {
        const loanId = positiveWholeValue(values, ["loanId"], "Loan ID");
        return {
          invocation: {
            scriptHash: targetHash,
            operation: "repayDebt",
            args: buildInvokeArgs(
              [
                { name: "loanId", type: "integer", required: true },
                {
                  name: "payer",
                  type: "hash160",
                  required: true,
                  default_value: "$wallet",
                },
                { name: "amount", type: "amount", required: true, scale: 8 },
              ],
              {
                loanId,
                payer: "$wallet",
                amount: formatFixed8Amount(BigInt(repayGas)),
              },
              walletAddress,
            ),
          },
          successMessage: (txid) => `Loan repayment submitted: ${txid}`,
        };
      }
      const args = buildInvokeArgsWithoutParams(
        operation,
        { ...values, appId: SELF_LOAN_APP_ID },
        walletAddress,
        ["repayGas", "amount", "repayAmount"],
      );
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, repayGas, SELF_LOAN_REPAY_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "repayLoan",
          args,
        },
        successMessage: (txid) => `Loan repayment submitted: ${txid}`,
      };
    },
  ),

  [`${SELF_LOAN_APP_ID}:addCollateral`]: fundedRecipe(
    "SelfLoan contract",
    "collateral transaction",
    ({ operation, values, walletAddress, targetHash, targetNetwork }) => {
      const collateralNeo = positiveWholeValue(
        values,
        ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
        "Collateral NEO",
      );
      if (targetNetwork === "mainnet") {
        const loanId = positiveWholeValue(values, ["loanId"], "Loan ID");
        return {
          invocation: {
            scriptHash: targetHash,
            operation: "addCollateral",
            args: buildInvokeArgs(
              [
                { name: "loanId", type: "integer", required: true },
                {
                  name: "depositor",
                  type: "hash160",
                  required: true,
                  default_value: "$wallet",
                },
                {
                  name: "neoAmount",
                  type: "integer",
                  required: true,
                },
              ],
              { loanId, depositor: "$wallet", neoAmount: collateralNeo },
              walletAddress,
            ),
          },
          successMessage: (txid) => `Collateral added: ${txid}`,
        };
      }
      const args = buildInvokeArgsWithoutParams(
        operation,
        { ...values, appId: SELF_LOAN_APP_ID },
        walletAddress,
        ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
      );
      return {
        deposits: [
          neoTransfer(
            walletAddress,
            targetHash,
            collateralNeo,
            SELF_LOAN_COLLATERAL_MEMO,
          ),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "addCollateral",
          args,
        },
        successMessage: (txid) => `Collateral added: ${txid}`,
      };
    },
  ),

  [`${GRAVEYARD_APP_ID}:buryMemory`]: fundedRecipe(
    "Graveyard contract",
    "funded burial transaction",
    ({ values, walletAddress, targetHash }) => {
      const contentHash = normalizedSha256Hash(values, [
        "contentHash",
        "assetHash",
        "hash",
      ]);
      const memoryType = integerRangeValue(
        values,
        ["memoryType", "type"],
        "Memory type",
        1,
        5,
      );
      const feeAmount =
        optionalPositiveFixed8Value(
          values,
          ["feeGas", "amount", "buryFeeGas"],
          "Burial fee",
        ) ?? GRAVEYARD_DEFAULT_BURY_FEE_FIXED8;
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, feeAmount, GRAVEYARD_BURY_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "buryMemory",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "String", value: contentHash },
            { type: "Integer", value: memoryType },
          ],
        },
        successMessage: (txid) => `Memory buried: ${txid}`,
      };
    },
  ),

  [`${GRAVEYARD_APP_ID}:forgetMemory`]: fundedRecipe(
    "Graveyard contract",
    "funded forgetting transaction",
    ({ values, walletAddress, targetHash }) => {
      const memoryId = positiveWholeValue(values, ["memoryId", "id"], "Memory ID");
      const feeAmount =
        optionalPositiveFixed8Value(
          values,
          ["feeGas", "amount", "forgetFeeGas"],
          "Forgetting fee",
        ) ?? GRAVEYARD_DEFAULT_FORGET_FEE_FIXED8;
      return {
        deposits: [
          gasTransfer(walletAddress, targetHash, feeAmount, GRAVEYARD_FORGET_MEMO),
        ],
        invocation: {
          scriptHash: targetHash,
          operation: "forgetMemory",
          args: [
            { type: "Hash160", value: walletAddress },
            { type: "Integer", value: memoryId },
          ],
        },
        successMessage: (txid) => `Memory forgotten: ${txid}`,
      };
    },
  ),

  [`${DAILY_CHECKIN_APP_ID}:checkIn`]: simpleRecipe(
    "Daily Check-in contract",
    ({ walletAddress, targetHash }) => ({
      invocation: gasTransfer(
        walletAddress,
        targetHash,
        DAILY_CHECKIN_FEE_FIXED8,
        DAILY_CHECKIN_MEMO,
      ),
      successMessage: (txid) => `Check-in transaction submitted: ${txid}`,
    }),
  ),
};

/**
 * Resolves the invoke recipe for an operation: exact `"appId:method"` entries
 * take precedence over wildcard `"*:method"` entries.
 */
export function resolveInvokeRecipe(
  appId: string,
  method: string,
): InvokeRecipe | null {
  return (
    MINIAPP_INVOKE_RECIPES[`${appId}:${method}`] ??
    MINIAPP_INVOKE_RECIPES[`*:${method}`] ??
    null
  );
}
