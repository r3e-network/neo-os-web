/**
 * quadraticFlowKit — the shared plumbing every Quadratic Funding flow uses,
 * built ONLY on the MiniApp framework SDK (ctx.framework).
 *
 * This file is the app-side residue of the legacy-stack rewrite (plan §3
 * Wave 5): the hand-rolled useWallet/useContractInteraction/useContractAddress
 * wiring, the deposit-then-invoke sequence and the null-scaler are gone —
 * what remains is the app-specific glue the framework cannot own:
 *
 *  - `guard`     — app.notify.guardResult around a chain flow, MIRRORED into
 *                  the in-card status banner (PlayArea's `.qf-setup-card__notice`
 *                  / `.qf-controls__status`) with the exact legacy copy. The
 *                  returned boolean replaces the old `succeededSince` status-
 *                  snapshot success detection.
 *  - `onNeoChain`— the silent wrong-chain early-return that used to be
 *                  `requireNeoChain(wallet.chainType, t)`.
 *  - `ensureCaller` / `ensureContract` — the wallet/contract preconditions
 *                  with this app's localized copy ("walletNotConnected" /
 *                  "contractMissing").
 *  - `scaleAssetAmount` — the legacy-permissive human→base-unit scaler on top
 *                  of the framework's never-throwing app.amount.parse* lane.
 *  - `settleDeposit` — the deposit-confirmation wait injected into
 *                  app.funds.prepayAndCall's asset deposit lane.
 */

import type { MiniAppFramework } from "@shared/react";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { resolveNeoNetwork } from "@shared/constants";
import {
  waitForDepositConfirmation,
  type DepositConfirmation,
} from "@shared/composables/useContractInteraction";

export type StatusSetter = (msg: string, type: "success" | "error") => void;

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type ScaledAmountResult =
  | { ok: true; value: string }
  | { ok: false; reason: "fractionalNeo" | "invalid" };

export interface QuadraticTxResult {
  txid?: string;
  verified?: boolean;
  event?: unknown;
}

export interface QuadraticFlowKitOptions {
  /** MiniApp framework SDK from ctx.framework — the only service surface. */
  app: MiniAppFramework;
  /** Translation function (app + common messages). */
  t: Translator;
  /**
   * In-card status banner setter (useStatusMessage policy: sticky errors,
   * auto-dismissed successes). Every flow outcome lands here with the exact
   * pre-rewrite copy, in addition to the platform notify channel.
   */
  setStatus: StatusSetter;
  /** Clear the in-card banner (see QuadraticFlowKit.clearStatus). */
  clearStatus: () => void;
  /**
   * Override the deposit-confirmation wait used by the deposit-then-act
   * flows. Defaults to {@link waitForDepositConfirmation} polling the N3Index
   * for the transfer's indexed NEP-17 Transfer event on the asset token
   * contract, on the wallet's own network. Injectable for tests.
   */
  confirmDeposit?: (
    txid: string,
    assetHash: string,
  ) => Promise<DepositConfirmation>;
}

/**
 * Chain types the flows accept — the same set the legacy `requireNeoChain`
 * guard allowed. Anything else (Neo X EVM lanes) makes the write flows
 * return early without a banner, exactly like the old guard.
 */
const N3_CHAIN_TYPES = new Set(["neo-n3", "neo-n3-mainnet", "neo-n3-testnet"]);

const utf8Encoder = new TextEncoder();

/**
 * Contract text limits are UTF-8 BYTES, not JS UTF-16 chars: the devpack
 * compiles C# `string.Length` to the SIZE opcode over the UTF-8 ByteString
 * (MiniAppQuadraticFunding.Internal.cs asserts title ≤ 60 / round description
 * ≤ 240 / project name ≤ 60 / project description ≤ 300 / link ≤ 200 / memo
 * ≤ 160 on that unit), so a char-based `.slice(0, 60)` let CJK text through
 * at up to 3× the byte budget and the consuming call reverted "… too long".
 * On the deposit-then-act lanes (createRound, contribute) that revert lands
 * AFTER the matching-pool / contribution deposit, stranding it as
 * reclaimable-but-manual prepaid credit. Measure and truncate in the
 * contract's unit instead.
 */
export const utf8ByteLength = (value: string): number =>
  utf8Encoder.encode(value).length;

/**
 * Truncate to at most `maxBytes` UTF-8 bytes on a whole-codepoint boundary
 * (never splits a surrogate pair or multi-byte sequence).
 */
export const truncateUtf8Bytes = (value: string, maxBytes: number): string => {
  if (utf8Encoder.encode(value).length <= maxBytes) return value;
  let out = "";
  let bytes = 0;
  for (const codepoint of value) {
    const size = utf8Encoder.encode(codepoint).length;
    if (bytes + size > maxBytes) break;
    out += codepoint;
    bytes += size;
  }
  return out;
};

export interface QuadraticFlowKit {
  setStatus: StatusSetter;
  /**
   * Drop the in-card banner entirely. Distinct from setStatus: there is no
   * honest "success"/"error" tone for "there is nothing to report", which is
   * exactly the state a pre-connect read leaves behind.
   */
  clearStatus(): void;
  /** Banner an error with the legacy formatErrorMessage + contractMissing fallback. */
  reportError(error: unknown): void;
  /**
   * Silent wrong-chain guard (legacy `requireNeoChain` early return). Note
   * the framework network probe treats an uninitialized wallet chainType as
   * Neo N3, so a click during wallet init proceeds to the connect flow
   * instead of the legacy silent no-op — the chain check inside every
   * framework read/invoke still rejects a genuinely wrong network.
   */
  onNeoChain(): Promise<boolean>;
  /**
   * Whether a contract this app can read has actually been resolved yet.
   *
   * DISPLAY ONLY — this is not a gate; ensureContract() below remains the sole
   * write boundary and still throws for every case this reports false. The
   * split exists because a chain read that fails has two very different causes
   * and the desk reported both as "Contract address not configured":
   *   - a resolved contract whose read genuinely broke (a real fault), and
   *   - no host bridge / no wallet, so no contract could be resolved at all.
   * The second is what EVERY first-time visitor sees before connecting. There
   * is nothing misconfigured about it, and the desk's own empty-round copy
   * ("Load or create a round before donation") already says the right thing.
   */
  hasChainContext(): Promise<boolean>;
  /**
   * app.notify.guardResult around a chain flow: toasts the outcome on the
   * platform notify channel AND mirrors it into the in-card banner with the
   * legacy copy (t(successKey) / formatErrorMessage(error, t("contractMissing"))).
   * Resolves with the explicit success boolean the PlayArea uses to clear
   * its inputs — the replacement for the old `succeededSince` snapshot.
   */
  guard(fn: () => Promise<unknown>, successKey: string): Promise<boolean>;
  /** Connect the wallet and return the caller address, or throw the legacy copy. */
  ensureCaller(): Promise<string>;
  /**
   * Resolve the deployed contract hash (required by the prepay deposit lane,
   * which reads the same accessor). The framework fills the accessor on the
   * first default-contract read; when a write fires before any read has
   * landed, nudge resolution with a cheap admin read. A still-missing
   * contract throws the legacy "contractMissing" copy.
   */
  ensureContract(): Promise<string>;
  /** Deposit-confirmation wait for the prepay lane (see options.confirmDeposit). */
  settleDeposit(txid: string, assetHash: string): Promise<DepositConfirmation>;
  /**
   * Human input → base-unit integer string via app.amount.parseAssetToUnits
   * (never throws). Dot-leading/trailing GAS amounts remain friendly, while
   * malformed extra separators and precision beyond 8 decimals reject instead
   * of being silently truncated. NEO keeps its distinct indivisible error.
   */
  scaleAssetAmount(
    assetSymbol: string,
    raw: string,
    options?: { allowZero?: boolean },
  ): ScaledAmountResult;
  /** Require the exact requested event, not merely a broadcast txid. */
  requireVerifiedTransaction(
    result: QuadraticTxResult,
    matches?: (event: unknown) => boolean,
  ): void;
}

export function createQuadraticFlowKit({
  app,
  t,
  setStatus,
  clearStatus,
  confirmDeposit,
}: QuadraticFlowKitOptions): QuadraticFlowKit {
  const reportError = (error: unknown): void => {
    setStatus(formatErrorMessage(error, t("contractMissing")), "error");
  };

  const kit: QuadraticFlowKit = {
    setStatus,
    clearStatus,
    reportError,

    async onNeoChain() {
      return N3_CHAIN_TYPES.has(await app.chain.detectNetwork());
    },

    async hasChainContext() {
      if (app.chain.contractAddress.get()) return true;
      // The framework fills the accessor on the first default-contract read;
      // nudge it once, exactly like ensureContract does, before concluding
      // there is no contract to talk to.
      await app.chain.readRaw("admin", []).catch(() => undefined);
      return Boolean(app.chain.contractAddress.get());
    },

    async guard(fn, successKey) {
      const result = await app.notify.guardResult(fn, {
        successKey,
        errorKey: "contractMissing",
      });
      if (result.ok) {
        setStatus(t(successKey), "success");
        return true;
      }
      reportError(result.error);
      return false;
    },

    async ensureCaller() {
      await app.chain.ensureWallet();
      const caller = app.chain.address.get();
      if (!caller) throw new Error(t("walletNotConnected"));
      return caller;
    },

    async ensureContract() {
      if (!app.chain.contractAddress.get()) {
        // Resolution errors fall through to the guard below so the legacy
        // "contractMissing" copy is what the user sees.
        await app.chain.readRaw("admin", []).catch(() => undefined);
      }
      const contract = app.chain.contractAddress.get();
      if (!contract) throw new Error(t("contractMissing"));
      return contract;
    },

    async settleDeposit(txid, assetHash) {
      if (confirmDeposit) return confirmDeposit(txid, assetHash);
      return waitForDepositConfirmation(txid, {
        network: resolveNeoNetwork(await app.chain.detectNetwork()),
        contractHash: assetHash,
      });
    },

    scaleAssetAmount(assetSymbol, raw, options) {
      const normalizedAsset = assetSymbol.trim().toUpperCase();
      if (normalizedAsset !== "NEO" && normalizedAsset !== "GAS") {
        return { ok: false, reason: "invalid" };
      }
      const asset = normalizedAsset;
      const value = raw.trim();
      // NEO is indivisible — any "."/"," is the distinct fractional reject
      // (parse* would collapse it into a generic null).
      if (asset === "NEO" && /[.,]/.test(value)) {
        return { ok: false, reason: "fractionalNeo" };
      }
      // Legacy-permissive GAS spellings the strict parser rejects:
      // ".5" → "0.5" and "5." → "5".
      const normalized = asset === "GAS"
        ? value.replace(/^\./, "0.").replace(/\.$/, "")
        : value;
      const validShape = asset === "NEO"
        ? /^(?:0|[1-9]\d*)$/.test(normalized)
        : /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(normalized);
      if (!validShape) return { ok: false, reason: "invalid" };
      const scaled = app.amount.parseAssetToUnits(asset, normalized, {
        allowZero: options?.allowZero === true,
      });
      return scaled === null
        ? { ok: false, reason: "invalid" }
        : { ok: true, value: scaled };
    },

    requireVerifiedTransaction(result, matches = () => true) {
      if (
        !result?.txid
        || result.verified !== true
        || !result.event
        || !matches(result.event)
      ) {
        throw new Error(t("writeAwaitingConfirmation", {
          txid: result?.txid || t("notAvailable"),
        }));
      }
    },
  };

  return kit;
}
