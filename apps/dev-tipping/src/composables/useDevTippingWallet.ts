/**
 * useDevTippingWallet — On-chain mutations for the Dev Tipping miniapp.
 *
 * Talks DIRECTLY to the app's standalone contract (MiniAppTipJar) via
 * ctx.services.chain. The earlier path deposited through the OS PaymentProxy
 * edge function, which scaled the human amount itself and moved nothing once the
 * kernel degraded. This composable drives the contract directly, scaling GAS to
 * BASE UNITS in-process, so the tip is real.
 *
 * Contract interaction model (verified against MiniAppTipJar.cs / ABI):
 *
 *   TIP (deposit-then-act, two signed steps by the tipper):
 *     1. DEPOSIT — a GAS transfer to the contract with the memo
 *        "miniapp-devtipping:tip" so OnNEP17Payment credits the tipper's balance:
 *          transfer(tipper, CONTRACT, amountBaseUnits, "miniapp-devtipping:tip")
 *          { scriptHash: GAS_HASH }
 *     2. tip(tipper, devId, amountBaseUnits, anonymous) — moves the amount from
 *        the tipper's credit to the developer's claimable balance. If step 1
 *        lands but step 2 reverts, the credit persists on the contract under the
 *        tipper as reusable prepaid credit (reclaimable via withdraw) — no funds
 *        are lost, and the next tip skips the deposit when credit already covers
 *        it.
 *
 *   REGISTER — registerDeveloper(wallet, name, role) under the wallet's witness;
 *     each wallet registers once. Returns the new devId (read from the
 *     DeveloperRegistered event).
 *
 *   WITHDRAW TIPS — withdrawTips(devId) under the developer wallet's witness;
 *     pays the developer's accrued claimable balance to their wallet.
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS (GAS × 1e8). MIN_TIP 0.001
 * GAS (100000 base units) — enforced both on-chain and here. The human amount is
 * scaled to base units in-process (toBaseUnits, no floats); callers pass the
 * human-decimal string and this composable scales ONCE.
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { EventBus } from "@shared/services";
import { eventValue } from "@shared/utils/chain-events";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

/** Minimum tip in GAS (mirrors the contract's MIN_TIP = 0.001 GAS). */
export const MIN_TIP = 0.001;

/** MIN_TIP in base units (0.001 GAS = 100000). */
const MIN_TIP_BASE = 100_000n;

/** Max name / role length the contract accepts. */
const MAX_NAME_LEN = 64;
const MAX_ROLE_LEN = 64;

/** Memo the contract requires on the tip-funding transfer (appId + ":tip"). */
const TIP_MEMO = "miniapp-devtipping:tip";

export interface UseDevTippingWalletOptions {
  app: MiniAppFramework;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useDevTippingWallet({ app, eventBus, t }: UseDevTippingWalletOptions) {
  const isLoading = createObservable(false);
  const isRegistering = createObservable(false);
  const isWithdrawing = createObservable(false);

  /**
   * Send a tip to a developer (deposit-then-act).
   *
   * `tipMessage` / `tipperName` are kept for the UI layer only — the contract
   * stores neither (the on-chain Tipped event carries devId, tipper address,
   * amount, anonymous). They are accepted here so the form keeps working without
   * inventing on-chain fields.
   *
   * Returns true on a confirmed on-chain tip, false for a no-op guard, throws on
   * failure so notify.guard reports the real error.
   */
  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    _tipMessage: string,
    _tipperName: string,
    anonymous: boolean,
    onSuccess?: () => void,
  ): Promise<boolean> => {
    if (!selectedDevId || selectedDevId <= 0 || !tipAmount) return false;
    if (isLoading.get()) return false;

    isLoading.set(true);
    try {
      const amount = Number.parseFloat(tipAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(t("invalidAmount"));
      }
      if (amount < MIN_TIP) {
        throw new Error(t("minTip"));
      }

      // GAS → base units via the framework amount layer (Fixed8; validates the
      // decimal). Already guarded as a positive amount >= MIN_TIP above.
      const amountBase = app.amount.gasToFixed8(tipAmount);
      if (amountBase < MIN_TIP_BASE) {
        throw new Error(t("minTip"));
      }

      const tipperAddr = app.chain.address.get() || (await app.chain.ensureWallet());
      if (!tipperAddr) {
        throw new Error(t("walletNotConnected"));
      }
      const tipperArg = app.chain.arg.hash160(tipperAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) {
        throw new Error(t("contractNotReady"));
      }

      // Step 1: DEPOSIT — only top up when existing tip credit can't cover the
      // amount (credit may persist from a prior aborted tip). The contract scales
      // nothing; the amount is already in BASE UNITS here.
      let credit = 0n;
      try {
        credit = parseBigInt(await app.chain.readRaw("creditOf", [tipperArg]));
      } catch {
        credit = 0n;
      }

      let depositSettled = false;
      if (credit < amountBase) {
        await app.chain.invoke(
          "transfer",
          [
            tipperArg,
            app.chain.arg.hash160(contractHash),
            app.chain.arg.integer(amountBase),
            app.chain.arg.string(TIP_MEMO),
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
        depositSettled = true;
      }

      // Step 2: tip — moves the amount from the tipper's credit to the
      // developer's claimable balance in this tx. If the deposit landed but this
      // reverts, the credit persists as reusable prepaid credit (reclaimable via
      // withdraw); surface that distinctly when the deposit settled this round.
      try {
        await app.chain.invoke(
          "tip",
          [
            tipperArg,
            app.chain.arg.integer(Math.trunc(selectedDevId)),
            app.chain.arg.integer(amountBase),
            app.chain.arg.boolean(anonymous),
          ],
          { waitForEvent: "Tipped" },
        );
      } catch (tipErr) {
        const raw = tipErr instanceof Error ? tipErr.message : String(tipErr);
        if (depositSettled) {
          throw new Error(t("tipPrepaidNoTip"));
        }
        throw new Error(raw || t("error"));
      }

      eventBus.emit("devtipping:tipsent", { devId: selectedDevId, amount });
      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      eventBus.emit("devtipping:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Self-register the connected wallet as a developer. The caller must witness
   * their own wallet, and each wallet can register at most once. Returns the new
   * devId (read from the DeveloperRegistered event), or 0 if it could not be
   * resolved (the registration still landed on chain).
   */
  const registerDeveloper = async (
    name: string,
    role: string,
    onSuccess?: () => void,
  ): Promise<number> => {
    if (isRegistering.get()) return 0;

    isRegistering.set(true);
    try {
      const trimmedName = String(name ?? "").trim();
      if (!trimmedName || trimmedName.length > MAX_NAME_LEN) {
        throw new Error(t("invalidDevName"));
      }
      const trimmedRole = String(role ?? "").trim();
      if (trimmedRole.length > MAX_ROLE_LEN) {
        throw new Error(t("invalidDevRole"));
      }

      const walletAddr = app.chain.address.get() || (await app.chain.ensureWallet());
      if (!walletAddr) {
        throw new Error(t("walletNotConnected"));
      }

      const result = await app.chain.invoke(
        "registerDeveloper",
        [
          app.chain.arg.hash160(walletAddr),
          app.chain.arg.string(trimmedName),
          app.chain.arg.string(trimmedRole),
        ],
        { waitForEvent: "DeveloperRegistered" },
      );

      // DeveloperRegistered(devId, wallet, name) — devId is state slot 0.
      const devId = Number(parseBigInt(eventValue(result.event, 0)));

      eventBus.emit("devtipping:registered", { devId, name: trimmedName });
      if (onSuccess) onSuccess();
      return Number.isFinite(devId) && devId > 0 ? devId : 0;
    } catch (e) {
      eventBus.emit("devtipping:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isRegistering.set(false);
    }
  };

  /**
   * Withdraw the connected developer's accrued claimable balance to their
   * wallet. The contract requires the developer wallet's witness. Returns the
   * amount paid in human GAS (read from the TipsWithdrawn event), or 0 if it
   * could not be resolved (the withdrawal still landed on chain).
   */
  const withdrawTips = async (devId: number, onSuccess?: () => void): Promise<number> => {
    if (!devId || devId <= 0) return 0;
    if (isWithdrawing.get()) return 0;

    isWithdrawing.set(true);
    try {
      // The contract checks the witness against the developer's registered
      // wallet; ensure a wallet is connected before prompting.
      await app.chain.ensureWallet();

      const result = await app.chain.invoke(
        "withdrawTips",
        [app.chain.arg.integer(Math.trunc(devId))],
        { waitForEvent: "TipsWithdrawn" },
      );

      // TipsWithdrawn(devId, wallet, amount) — amount is state slot 2 (base units).
      const amountBase = parseBigInt(eventValue(result.event, 2));
      const amount = Number(amountBase) / 1e8;

      eventBus.emit("devtipping:withdrawn", { devId, amount });
      if (onSuccess) onSuccess();
      return Number.isFinite(amount) ? amount : 0;
    } catch (e) {
      eventBus.emit("devtipping:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isWithdrawing.set(false);
    }
  };

  /**
   * Reclaim the connected wallet's stranded tip credit via withdraw(account).
   * A deposit that landed but whose tip step failed persists as reusable prepaid
   * credit; this returns it to the wallet (CreditWithdrawn event). Returns the
   * amount paid in human GAS, or 0 if it could not be resolved.
   */
  const withdrawCredit = async (onSuccess?: () => void): Promise<number> => {
    if (isWithdrawing.get()) return 0;

    isWithdrawing.set(true);
    try {
      const addr = app.chain.address.get() || (await app.chain.ensureWallet());
      if (!addr) throw new Error(t("walletNotConnected"));

      const result = await app.chain.invoke(
        "withdraw",
        [app.chain.arg.hash160(addr)],
        { waitForEvent: "CreditWithdrawn" },
      );

      // CreditWithdrawn(account, amount) — amount is state slot 1 (base units).
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = Number(amountBase) / 1e8;

      eventBus.emit("devtipping:creditwithdrawn", { amount });
      if (onSuccess) onSuccess();
      return Number.isFinite(amount) ? amount : 0;
    } catch (e) {
      eventBus.emit("devtipping:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isWithdrawing.set(false);
    }
  };

  return {
    address: app.chain.address,
    isLoading,
    isRegistering,
    isWithdrawing,
    sendTip,
    registerDeveloper,
    withdrawTips,
    withdrawCredit,
  };
}
