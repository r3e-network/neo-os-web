/**
 * Neo Treasury — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { fetchTreasuryData, type TreasuryData } from "./utils/treasury";
import {
  assertTreasurySpendableBalance,
  assertTreasuryWalletNetwork,
  buildPendingTreasuryTransfer,
  buildTreasuryTransferIntent,
  formatTreasuryOperationError,
  inspectPendingTreasuryTransfer,
  normalizeTreasuryHash160,
  normalizeTreasuryNetwork,
  normalizeTreasuryTxid,
  parsePendingTreasuryTransfer,
  parseTreasuryBalance,
  type PendingTreasuryTransfer,
  type TreasurySettlementResult,
  type TreasuryTransferIntent,
  TreasuryOperationError,
} from "./utils/treasuryOperations";

// Key remainder under the pinned "neo_treasury_" storage prefix — the on-disk
// localStorage key stays the legacy runtime-cache "neo_treasury_cache"
// byte-for-byte, so existing users keep their cached dashboard.
const CACHE_KEY = "cache";
const PENDING_TRANSFER_KEY_PREFIX = "pending-transfer-v1/";

function formatAmount(value: number, maximumFractionDigits: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

defineMiniApp({
  appId: "miniapp-neo-treasury",
  playArea: PlayArea,
  manifest,
  messages,
  // Pin app.storage.local to the legacy runtime-cache namespace so the
  // pre-framework "neo_treasury_cache" key keeps resolving byte-for-byte
  // (storage keys must not change across the framework migration).
  storagePrefix: "neo_treasury_",

  setup(ctx) {
    let disposed = false;
    let loadRequestId = 0;
    let confirmationRequestId = 0;
    const selectedNetwork = (() => {
      try {
        return normalizeTreasuryNetwork(ctx.launchContext?.network ?? "mainnet");
      } catch {
        return null;
      }
    })();
    const pendingStorageKey = selectedNetwork
      ? `${PENDING_TRANSFER_KEY_PREFIX}${selectedNetwork}`
      : null;
    const loading = createObservable(true);
    const error = createObservable("");
    const data = createObservable<TreasuryData | null>(null);
    // True when the displayed figures came from cache because the fresh fetch
    // failed — drives the amber "showing cached data" signal instead of the
    // green "live synced" one.
    const stale = createObservable(false);
    const address = createObservable(ctx.framework.chain.address.get() ?? "");
    const disbursementSubmitting = createObservable(false);
    const disbursementStatus = createObservable(ctx.t("disbursementDraftReady"));
    const disbursementError = createObservable("");
    const lastTxid = createObservable("");
    const lastIntent = createObservable<TreasuryTransferIntent | null>(null);
    const pendingTransfer = createObservable<PendingTreasuryTransfer | null>(null);
    const confirmationChecking = createObservable(false);
    const recoveryDurable = createObservable(true);
    const settlementStatus = createObservable("idle");
    const settlementMessage = createObservable("");

    if (pendingStorageKey && selectedNetwork) {
      try {
        const stored = ctx.framework.storage.local.get<unknown>(pendingStorageKey);
        const parsed = parsePendingTreasuryTransfer(stored);
        if (parsed?.network === selectedNetwork) {
          pendingTransfer.set(parsed);
          lastIntent.set(parsed);
          lastTxid.set(parsed.txid);
          settlementStatus.set("pending");
          settlementMessage.set(ctx.t("disbursementConfirmationPending"));
        } else if (stored) {
          // An invalid recovery record must never be retried or used to
          // authorize another transfer. Remove only that local record.
          ctx.framework.storage.local.delete(pendingStorageKey);
        }
      } catch {
        // The public dashboard remains available when local recovery storage is
        // blocked. A later broadcast will surface the recovery limitation.
        recoveryDurable.set(false);
      }
    }

    // ── Watchlist read-outs (one per value, for chrome AND PlayArea) ─────────
    // `data` is null until the watchlist sweep lands, and these report that
    // honestly as `undefined` — the unread state. Nothing has been set yet, so
    // there is no number and no dash to report, and neither consumer is handed
    // one to misread:
    //
    //   · the chrome renders the manifest binding's `pendingKey` ("Reading…"),
    //     because a string-valued binding cannot mount a skeleton;
    //   · the PlayArea passes the same copy as its `str()` fallback, and keeps
    //     its own richer gating (the vault notice, the live/stale signal).
    //
    // This is why there is no parallel display-only twin of each value: the
    // phase is declared once, in the manifest, instead of hand-written here.
    // `undefined` specifically — `null` and `""` are values this app may
    // legitimately report, and a settled count of zero is a real reading.
    const totalUsdDisplay: Observable<string | undefined> = {
      get: () => {
        const d = data.get();
        if (!d) return undefined;
        // Settled, but the independent price feed had nothing. That is a fact
        // about the valuation, not about the read — it must NOT borrow the
        // "still reading" copy, and must not fall back to a $0 that claims the
        // treasury is empty. The balances beside it stay real and keep
        // rendering.
        return typeof d.totalUsd === "number"
          ? `${ctx.t("currencySymbol")}${formatAmount(d.totalUsd, 2)}`
          : ctx.t("treasuryPriceUnavailableShort");
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalNeoDisplay: Observable<string | undefined> = {
      get: () => {
        const d = data.get();
        if (!d) return undefined;
        return d?.totalNeoDisplay ?? (
          d?.totalNeo !== undefined
            ? formatAmount(d.totalNeo, 4)
            : ctx.t("notAvailable")
        );
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalGasDisplay: Observable<string | undefined> = {
      get: () => {
        const d = data.get();
        if (!d) return undefined;
        return d?.totalGasDisplay ?? (
          d?.totalGas !== undefined
            ? formatAmount(d.totalGas, 4)
            : ctx.t("notAvailable")
        );
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const founderCount: Observable<number | undefined> = {
      get: () => {
        const d = data.get();
        // A count is a claim, and absence is not zero: `Founders 0` while the
        // read is in flight asserts this watchlist tracks nobody. Once the
        // read settles, a count of zero IS a real reading and must survive.
        if (!d) return undefined;
        return d.categories?.length ?? 0;
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };

    const loadData = async () => {
      const requestId = ++loadRequestId;
      if (disposed) return;
      loading.set(true);
      error.set("");

      try {
        const cached = ctx.framework.storage.local.get<TreasuryData>(CACHE_KEY);
        if (cached && !disposed && requestId === loadRequestId) {
          data.set(cached);
          // Cached balances/prices are not a live read — show the amber "stale"
          // signal until the fresh fetch resolves and sets real freshness, so old
          // cached USD is never momentarily presented as "live synced".
          stale.set(true);
        }
      } catch (_e) {
        console.warn("[neo-treasury] cache read failed:", _e instanceof Error ? _e.message : String(_e));
      }

      try {
        const freshData = await fetchTreasuryData();
        if (disposed || requestId !== loadRequestId) return;
        data.set(freshData);
        // A completed wallet-balance sweep is live even when the independent
        // on-chain USD quote is delayed. Keep balance-cache freshness and price
        // freshness separate so the UI never labels fresh native balances as
        // cached merely because the valuation quote is old.
        stale.set(false);
        try {
          ctx.framework.storage.local.set(CACHE_KEY, freshData);
        } catch (_e) {
          // A cache-write failure (quota/sandboxed storage) is non-fatal and
          // must not trip the outer catch into flagging the just-rendered
          // FRESH data as stale — the legacy safeWriteJSON lane swallowed it.
        }
      } catch (e) {
        if (disposed || requestId !== loadRequestId) return;
        if (!data.get()) {
          // messageOf adds the chain-error family mapping formatErrorMessage
          // lacks, so RPC failures show localized copy instead of raw English.
          error.set(ctx.framework.errors.messageOf(e, ctx.t("loadFailed")));
        } else {
          // We're rendering day-old cached figures — flag them as stale so the
          // hero shows the amber "cached data" signal, not "live synced".
          stale.set(true);
          console.warn("[neo-treasury] using cached data:", e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!disposed && requestId === loadRequestId) {
          loading.set(false);
        }
      }
    };

    const readNativeBalance = async (scriptHash: string, ownerHash: string) =>
      parseTreasuryBalance(
        await ctx.framework.chain.readRaw(
          "balanceOf",
          [{ type: "Hash160", value: ownerHash }],
          { scriptHash },
        ),
      );

    const persistPending = (pending: PendingTreasuryTransfer | null) => {
      pendingTransfer.set(pending);
      if (!pendingStorageKey) return false;
      try {
        if (pending) {
          ctx.framework.storage.local.set(pendingStorageKey, pending);
          const stored = parsePendingTreasuryTransfer(
            ctx.framework.storage.local.get<unknown>(pendingStorageKey),
          );
          return stored?.txid === pending.txid && stored.bindingKey === pending.bindingKey;
        }
        ctx.framework.storage.local.delete(pendingStorageKey);
        return true;
      } catch {
        // The in-memory recovery state still prevents duplicate submission for
        // this session. The caller surfaces that refresh recovery is unavailable.
        return false;
      }
    };

    const settlementCopy = (result: TreasurySettlementResult) => {
      switch (result.status) {
        case "confirmed":
          return ctx.t("disbursementConfirmed");
        case "binding-mismatch":
          return ctx.t("disbursementBindingMismatch");
        case "readback-pending":
          return ctx.t("disbursementReadbackPending");
        case "unreachable":
          return ctx.t("disbursementConfirmationUnavailable");
        default:
          return ctx.t("disbursementConfirmationPending");
      }
    };

    const confirmPendingTransfer = async (pending?: PendingTreasuryTransfer | null) => {
      const recovery = pending ?? pendingTransfer.get();
      if (disposed || !recovery || confirmationChecking.get()) return null;
      const requestId = ++confirmationRequestId;
      confirmationChecking.set(true);
      settlementStatus.set("checking");
      settlementMessage.set(ctx.t("disbursementCheckingConfirmation"));
      disbursementError.set("");
      let latest: TreasurySettlementResult = {
        status: "indexing",
        eventMatched: false,
        stateReadback: false,
      };

      try {
        const confirmed = await ctx.framework.chain.waitForState(
          async () => {
            latest = await inspectPendingTreasuryTransfer(recovery, {
              readRecipientBalance: readNativeBalance,
              readSenderBalance: readNativeBalance,
            });
            return latest;
          },
          (value) => value.status === "confirmed",
          { attempts: 4, firstDelayMs: 0, delayMs: 5_000 },
        );
        const result = confirmed ?? latest;
        if (disposed || requestId !== confirmationRequestId) return result;

        // Ignore a late poll from an older recovery run after the active record
        // changed. This keeps confirmation idempotent across rapid retries.
        if (pendingTransfer.get()?.txid !== recovery.txid) return result;
        if (result.status === "confirmed") {
          persistPending(null);
          lastIntent.set(recovery);
          lastTxid.set(recovery.txid);
          settlementStatus.set("confirmed");
          settlementMessage.set(ctx.t("disbursementConfirmed"));
          disbursementStatus.set(ctx.t("disbursementConfirmed"));
          void loadData();
        } else {
          settlementStatus.set(result.status);
          const nextCopy = !recoveryDurable.get() && result.status !== "binding-mismatch"
            ? ctx.t("disbursementRecoveryStorageUnavailable")
            : settlementCopy(result);
          settlementMessage.set(nextCopy);
          disbursementStatus.set(nextCopy);
          if (result.status === "binding-mismatch") {
            disbursementError.set(ctx.t("disbursementBindingMismatch"));
          }
        }
        return result;
      } catch {
        const result: TreasurySettlementResult = {
          status: "unreachable",
          eventMatched: latest.eventMatched,
          stateReadback: false,
        };
        if (
          !disposed &&
          requestId === confirmationRequestId &&
          pendingTransfer.get()?.txid === recovery.txid
        ) {
          settlementStatus.set(result.status);
          const nextCopy = recoveryDurable.get()
            ? ctx.t("disbursementConfirmationUnavailable")
            : ctx.t("disbursementRecoveryStorageUnavailable");
          settlementMessage.set(nextCopy);
          disbursementStatus.set(nextCopy);
        }
        return result;
      } finally {
        if (!disposed && requestId === confirmationRequestId) {
          confirmationChecking.set(false);
        }
      }
    };

    ctx.framework.actions.register("refresh", async () => {
      await loadData();
    });

    ctx.framework.actions.register("connectWallet", async () => {
      disbursementError.set("");
      const walletAddress = await ctx.framework.chain.ensureWallet();
      address.set(walletAddress);
      disbursementStatus.set(ctx.t("walletConnected"));
      return { address: walletAddress };
    });

    ctx.framework.actions.register("recoverDisbursement", async () => {
      return confirmPendingTransfer();
    });

    ctx.framework.actions.register("submitDisbursement", async (...args: unknown[]) => {
      if (disbursementSubmitting.get()) return null;
      if (pendingTransfer.get()) {
        return confirmPendingTransfer();
      }
      const form = (args[0] ?? {}) as Record<string, unknown>;
      disbursementSubmitting.set(true);
      disbursementError.set("");
      disbursementStatus.set(ctx.t("disbursementSigning"));

      try {
        if (!selectedNetwork) {
          // Reuse the domain error and localized copy used by the PlayArea.
          normalizeTreasuryNetwork(ctx.launchContext?.network);
        }
        const transferNetwork = selectedNetwork!;
        const walletAddress = await ctx.framework.chain.ensureWallet();
        address.set(walletAddress);
        const walletNetwork = await ctx.framework.chain.detectNetwork();
        assertTreasuryWalletNetwork(transferNetwork, walletNetwork);
        const intent = buildTreasuryTransferIntent(
          walletAddress,
          form,
          transferNetwork,
        );
        lastIntent.set(intent);

        // Read both sides immediately before opening the wallet. Besides the
        // spendability guard, these values become the authoritative post-event
        // readback baseline persisted with the exact transaction binding.
        const [senderBalance, recipientBalance] = await Promise.all([
          readNativeBalance(intent.scriptHash, intent.senderHash),
          readNativeBalance(intent.scriptHash, intent.recipientHash),
        ]);
        assertTreasurySpendableBalance(intent, senderBalance);

        // The wallet can change accounts or networks while the balance reads
        // are in flight. Re-resolve both immediately before opening the write
        // prompt so the reviewed signer remains the signer encoded in `from`.
        const finalWalletAddress = await ctx.framework.chain.ensureWallet();
        const finalWalletHash = normalizeTreasuryHash160(finalWalletAddress, "Connected wallet");
        if (finalWalletHash !== intent.senderHash) {
          address.set(finalWalletAddress);
          throw new TreasuryOperationError(
            "treasuryErrorWalletChanged",
            "Connected wallet changed while the transfer was being reviewed. Review the transfer again.",
          );
        }
        assertTreasuryWalletNetwork(transferNetwork, await ctx.framework.chain.detectNetwork());

        let recovery: PendingTreasuryTransfer | null = null;
        const rememberBroadcast = (txid: string) => {
          const next = buildPendingTreasuryTransfer(
            intent,
            txid,
            senderBalance,
            recipientBalance,
          );
          recovery = next;
          const durableRecovery = persistPending(next);
          recoveryDurable.set(durableRecovery);
          lastTxid.set(next.txid);
          settlementStatus.set("pending");
          const pendingCopy = durableRecovery
            ? ctx.t("disbursementConfirmationPending")
            : ctx.t("disbursementRecoveryStorageUnavailable");
          settlementMessage.set(pendingCopy);
          disbursementStatus.set(pendingCopy);
        };

        // This native-token event is indexed under the NEO/GAS contract rather
        // than this app id, so app.chain.waitForEvent cannot prove it. Persist
        // the exact binding at the broadcast boundary, then verify the indexed
        // native Transfer row + both balanceOf readbacks below.
        const result = await ctx.framework.chain.write({
          operation: "transfer",
          args: intent.args,
          scriptHash: intent.scriptHash,
          notify: "silent",
          onTransactionSent: rememberBroadcast,
        });

        const persistedAtBroadcast = pendingTransfer.get();
        if (!persistedAtBroadcast || persistedAtBroadcast.bindingKey !== intent.bindingKey) {
          rememberBroadcast(result.txid);
        } else if (normalizeTreasuryTxid(result.txid) !== persistedAtBroadcast.txid) {
          // A wallet/service disagreement over the broadcast txid is never a
          // confirmed outcome. Keep the first persisted recovery record and
          // require manual confirmation instead of guessing or rebroadcasting.
          settlementStatus.set("binding-mismatch");
          settlementMessage.set(ctx.t("disbursementBindingMismatch"));
          throw new Error(ctx.t("disbursementBindingMismatch"));
        } else {
          recovery = persistedAtBroadcast;
        }

        const settlement = await confirmPendingTransfer(recovery);
        return {
          ...result,
          // A txid alone is only a broadcast acknowledgement. Expose verified
          // true only after exact Transfer event and balance-state readback.
          verified: settlement?.status === "confirmed",
        };
      } catch (e) {
        if (pendingTransfer.get()) {
          if (settlementStatus.get() !== "binding-mismatch") {
            settlementStatus.set("pending");
            const pendingCopy = recoveryDurable.get()
              ? ctx.t("disbursementConfirmationPending")
              : ctx.t("disbursementRecoveryStorageUnavailable");
            settlementMessage.set(pendingCopy);
            disbursementStatus.set(pendingCopy);
          }
          throw e;
        }
        const message = e instanceof TreasuryOperationError
          ? formatTreasuryOperationError(e, ctx.t)
          // messageOf adds the chain-error family mapping formatErrorMessage
          // lacks, so wallet/VM failures show localized copy, not raw English.
          : ctx.framework.errors.messageOf(e, ctx.t("disbursementFailed"));
        disbursementError.set(message);
        disbursementStatus.set(message);
        throw e;
      } finally {
        disbursementSubmitting.set(false);
      }
    });

    const stopAddressSync = ctx.framework.chain.address.subscribe(() => {
      address.set(ctx.framework.chain.address.get() ?? "");
    });

    if (pendingTransfer.get()) {
      // Recovery never rebroadcasts: it only re-checks the persisted txid's
      // exact native Transfer row and the bound sender/recipient state.
      void confirmPendingTransfer(pendingTransfer.get());
    }

    return {
      state: {
        loading,
        error,
        data,
        stale,
        address,
        disbursementSubmitting,
        disbursementStatus,
        disbursementError,
        lastTxid,
        lastIntent,
        pendingTransfer,
        confirmationChecking,
        recoveryDurable,
        settlementStatus,
        settlementMessage,
        totalUsdDisplay,
        totalNeoDisplay,
        totalGasDisplay,
        founderCount,
      },
      loadData,
      cleanup: () => {
        disposed = true;
        loadRequestId += 1;
        confirmationRequestId += 1;
        stopAddressSync();
      },
    };
  },
});
