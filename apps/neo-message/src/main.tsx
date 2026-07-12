/**
 * Neo Message — Entry Point (React / OS Services Pattern)
 *
 * Encrypted + time-locked messaging on Neo X, backed by MiniAppMessageEVM and
 * the Morpheus confidential oracle. See message-logic.ts for the model.
 *
 * Framework migration (plan §3 Wave 5, PARTIAL): the device plaintext cache
 * rides app.storage.local (legacy keys pinned via storagePrefix) and the
 * busyIds/isLoading/isSending status wiring rides app.operations. The EVM
 * lane and the Morpheus confidential reveal protocol stay raw per plan §3.6
 * (framework is N3-only; app.oracle does not cover the reveal protocol).
 */

import { createObservable, defineMiniApp } from "@shared/react";
// framework-exempt: EVM lane (plan §3.6) — Neo Message is a Neo X (EVM) app;
// the framework chain surface is N3-only, so the EVM call/sign/decode helpers
// stay raw until a framework/evm wave exists.
import {
  encodeParams,
  evmCall,
  evmCallEncoded,
  evmPersonalSign,
  EVM_ACCOUNT_CHANGED_ERROR,
  decodeMessageStruct,
  utf8ToBytes,
  hasEvmWallet,
  getInjectedEthereum,
  type Eip1193Provider,
} from "@shared/utils/evm-chain";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { sleep } from "@shared/utils/format";
import { encryptTextWithOraclePublicKey } from "@shared/utils/morpheus-confidential-envelope";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  MESSAGE_EVM_ADDRESS,
  MAX_BODY_LENGTH,
  NEO_X_MAINNET,
  NEO_X_CHAIN_ID,
  SELECTORS,
  TOPICS,
  buildRevealStatement,
  decodeMessageIds,
  isMessageRecipient,
  isSupportedMessageNetwork,
  validateCompose,
  needsPublicRevealAck,
  addressesEqual,
  type ComposeForm,
  type MessageView,
} from "./message-logic";
import { createRevealOperations, operationBusyFlag } from "./operation-busy";
import { cachePlaintext, overlayCachedPlaintext } from "./plaintext-cache";
import {
  clearPendingDelivery,
  inspectPendingReceipt,
  isPendingDelivery,
  pendingDeliveryIsStale,
  readPendingDelivery,
  savePendingDelivery,
  type EvmReceiptView,
  type PendingDelivery,
} from "./pending-delivery";

const appId = "miniapp-neo-message";

const DEFAULT_FORM: ComposeForm = {
  recipient: "",
  body: "",
  lockMode: "recipient",
  revealDate: "",
  publicRevealAcknowledged: false,
};

// Cap the per-refresh getMessage fan-out: ids are monotonically increasing, so
// the newest PAGE_SIZE rows are the relevant ones; a heavy account would
// otherwise fire hundreds of parallel wallet-provider RPCs on every refresh.
const PAGE_SIZE = 50;

// Cache with a short TTL, not forever: the kernel's oracle encryption key carries
// a version and can be rotated (re-sealed in-TEE). A forever cache would keep
// encrypting to a stale key after a rotation, producing permanently undecryptable
// messages. Re-fetch every ORACLE_KEY_TTL_MS so a rotation is picked up. Once
// the TTL expires, fail closed rather than encrypting to a possibly retired key.
const ORACLE_KEY_TTL_MS = 5 * 60 * 1000;
let cachedOraclePublicKey = "";
let cachedOraclePublicKeyAt = 0;

function isRawX25519PublicKey(value: string): boolean {
  try {
    return globalThis.atob(value).length === 32;
  } catch {
    return false;
  }
}
// framework-exempt: Morpheus confidential envelope lane (plan §3.6) — this
// public-key fetch feeds the confidential seal protocol (the reveal's
// encrypt-side counterpart), which app.oracle does not cover.
async function getOraclePublicKey(unavailableMessage: string): Promise<string> {
  if (cachedOraclePublicKey && Date.now() - cachedOraclePublicKeyAt < ORACLE_KEY_TTL_MS) {
    return cachedOraclePublicKey;
  }
  let res: Response;
  try {
    res = await fetchWithTimeout("/api/morpheus/oracle/public-key?network=mainnet", {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new Error(unavailableMessage);
  }
  if (!res.ok) {
    throw new Error(unavailableMessage);
  }
  let body: { public_key?: string } = {};
  try {
    const parsed = JSON.parse(await res.text()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid oracle key payload");
    }
    body = parsed as { public_key?: string };
  } catch {
    throw new Error(unavailableMessage);
  }
  const publicKey = typeof body.public_key === "string" ? body.public_key.trim() : "";
  if (!publicKey || !isRawX25519PublicKey(publicKey)) {
    throw new Error(unavailableMessage);
  }
  cachedOraclePublicKey = publicKey;
  cachedOraclePublicKeyAt = Date.now();
  return cachedOraclePublicKey;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy storage namespace: the pre-framework device plaintext cache lived
  // at "<contract-address>:plaintext:v1", so pin app.storage.local to the
  // same "<contract-address>:" prefix — plaintext decrypted before the
  // migration still overlays (storage keys stay byte-identical).
  storagePrefix: `${MESSAGE_EVM_ADDRESS.toLowerCase()}:`,

  setup(ctx) {
    const app = ctx.framework;
    const address = createObservable("");
    const networkSupported = createObservable(false);
    const hasWallet = createObservable(hasEvmWallet());
    const inbox = createObservable<MessageView[]>([]);
    const outbox = createObservable<MessageView[]>([]);
    // Busy/status wiring rides app.operations: one shared operation gates the
    // list loaders (connectAndLoad / switchToNeoX / loadOlder previously
    // shared one hand-rolled isLoading flag), one gates the send flow, and
    // each reveal row gets its own operation. The ops carry no
    // successKey/errorKey and every work function swallows its own errors —
    // toast copy stays app-owned via ctx.setStatus, byte-identical to the
    // pre-migration flow.
    const loadOp = app.operations.create("loadMessages");
    const sendOp = app.operations.create("sendMessage");
    const recoverOp = app.operations.create("recoverPendingDelivery");
    const isLoading = operationBusyFlag(loadOp);
    const isSending = operationBusyFlag(sendOp);
    const isRecovering = operationBusyFlag(recoverOp);
    // Ids whose reveal is in flight — per-row so one slow poll does not disable
    // every other reveal button.
    const reveals = createRevealOperations((key) => app.operations.create(key));
    const busyIds = reveals.busyIds;
    // Whether more inbox/outbox ids exist beyond the loaded page.
    const hasMore = createObservable(false);
    const hasMoreInbox = createObservable(false);
    const hasMoreOutbox = createObservable(false);
    const inboxPageSize = createObservable(PAGE_SIZE);
    const outboxPageSize = createObservable(PAGE_SIZE);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const composeForm = createObservable<ComposeForm>({ ...DEFAULT_FORM });
    const pendingDelivery = createObservable<PendingDelivery | null>(
      readPendingDelivery(app.storage.local),
    );
    const pendingStorageHealthy = createObservable(true);
    const pendingRevealIds = createObservable<string[]>([]);
    let mailboxRequestId = 0;
    let disposed = false;
    const backgroundTimers = new Set<ReturnType<typeof setTimeout>>();
    const backgroundRechecks = new Set<string>();
    let boundProvider: Eip1193Provider | null = null;
    let accountsChangedListener: ((value: unknown) => void) | null = null;
    let chainChangedListener: ((value: unknown) => void) | null = null;

    const setForm = (patch: Partial<ComposeForm>) => composeForm.set({ ...composeForm.get(), ...patch });

    const rememberPendingDelivery = (value: PendingDelivery) => {
      if (!isPendingDelivery(value)) {
        pendingStorageHealthy.set(false);
        return;
      }
      pendingDelivery.set(value);
      pendingStorageHealthy.set(savePendingDelivery(app.storage.local, value));
    };

    const forgetPendingDelivery = () => {
      const cleared = clearPendingDelivery(app.storage.local);
      pendingStorageHealthy.set(cleared);
      if (cleared) pendingDelivery.set(null);
      return cleared;
    };

    const cancelBackgroundWork = () => {
      backgroundTimers.forEach((timer) => globalThis.clearTimeout(timer));
      backgroundTimers.clear();
      backgroundRechecks.clear();
    };

    const resetMailbox = () => {
      mailboxRequestId += 1;
      cancelBackgroundWork();
      // Never show a previous wallet's private-open rows under a newly active
      // account while its mailbox refresh is still in flight.
      inbox.set([]);
      outbox.set([]);
      inboxPageSize.set(PAGE_SIZE);
      outboxPageSize.set(PAGE_SIZE);
      hasMore.set(false);
      hasMoreInbox.set(false);
      hasMoreOutbox.set(false);
      pendingRevealIds.set([]);
    };

    const activateAddress = (nextAddress: string, forceReset = false) => {
      const previousAddress = address.get();
      if (forceReset || !addressesEqual(previousAddress, nextAddress)) resetMailbox();
      address.set(nextAddress);
    };

    const assertDeliveryMatches = (
      message: MessageView,
      expected: Pick<PendingDelivery, "sender" | "recipient" | "unlockTime">,
    ) => {
      if (
        !addressesEqual(message.sender, expected.sender) ||
        !addressesEqual(message.recipient, expected.recipient) ||
        message.unlockTime !== expected.unlockTime ||
        message.sentAt <= 0
      ) {
        throw new Error(ctx.t("statusSendReadbackMismatch"));
      }
    };

    const readMessage = async (id: string): Promise<MessageView> => {
      const raw = await evmCall(MESSAGE_EVM_ADDRESS, SELECTORS.getMessage, [id]);
      const m = decodeMessageStruct(raw);
      if (
        /^[1-9]\d*$/.test(id) &&
        isMessageRecipient(m.sender) &&
        isMessageRecipient(m.recipient) &&
        Number.isSafeInteger(m.unlockTime) &&
        m.unlockTime >= 0 &&
        Number.isSafeInteger(m.sentAt) &&
        m.sentAt > 0 &&
        typeof m.plaintext === "string" &&
        m.plaintext.length <= MAX_BODY_LENGTH &&
        (m.revealed ? m.plaintext.length > 0 : m.plaintext.length === 0)
      ) {
        return {
          id,
          sender: m.sender,
          recipient: m.recipient,
          unlockTime: m.unlockTime,
          sentAt: m.sentAt,
          revealed: m.revealed,
          plaintext: m.plaintext,
          timeLocked: m.unlockTime > 0,
        };
      }
      throw new Error(ctx.t("messageReadInvalid", { id }));
    };

    const tryReadMessage = async (id: string): Promise<MessageView | null> => {
      try {
        return await readMessage(id);
      } catch {
        return null;
      }
    };

    const readMessageWithRetry = async (id: string): Promise<MessageView> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          return await readMessage(id);
        } catch (error) {
          lastError = error;
          if (attempt < 4) await sleep(1200);
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(ctx.t("statusSendUnverified"));
    };

    const loadIdsFor = async (
      selector: string,
      who: string,
      limit: number,
    ): Promise<{ rows: MessageView[]; total: number }> => {
      const argsHex = encodeParams([{ t: "address", v: who }]);
      const raw = await evmCallEncoded(MESSAGE_EVM_ADDRESS, selector, argsHex);
      const allIds = decodeMessageIds(raw);
      // Slice to the newest page before fetching (ids are monotonic) so we never
      // fan out an unbounded number of getMessage calls.
      const pageIds = [...allIds]
        .sort((a, b) => (a === b ? 0 : a > b ? -1 : 1))
        .slice(0, limit)
        .map((id) => id.toString());
      const fetched = await Promise.allSettled(pageIds.map((id) => readMessage(id)));
      const failedReads = fetched.filter((result) => result.status === "rejected").length;
      if (failedReads > 0) {
        throw new Error(ctx.t("messageReadIncomplete", { count: failedReads }));
      }
      const rows = fetched
        .filter((result): result is PromiseFulfilledResult<MessageView> => result.status === "fulfilled")
        .map((result) => result.value)
        .sort((a, b) => {
          const left = BigInt(a.id);
          const right = BigInt(b.id);
          return left === right ? 0 : left > right ? -1 : 1;
        });
      return { rows, total: allIds.length };
    };

    const refreshLists = async (who: string): Promise<"applied" | "stale"> => {
      const requestId = ++mailboxRequestId;
      const inboxLimit = inboxPageSize.get();
      const outboxLimit = outboxPageSize.get();
      const [inboxResult, outboxResult] = await Promise.all([
        loadIdsFor(SELECTORS.inboxOf, who, inboxLimit),
        loadIdsFor(SELECTORS.outboxOf, who, outboxLimit),
      ]);
      if (requestId !== mailboxRequestId || !addressesEqual(address.get(), who)) {
        return "stale";
      }
      // Overlay any device-cached recipient-only plaintext back onto rows so a
      // just-decrypted message survives a refresh without a fresh signature +
      // oracle round-trip (only for rows the connected wallet can decrypt).
      inbox.set(overlayCachedPlaintext(app.storage.local, inboxResult.rows, who));
      outbox.set(outboxResult.rows);
      const inboxMore = inboxResult.total > inboxLimit;
      const outboxMore = outboxResult.total > outboxLimit;
      hasMoreInbox.set(inboxMore);
      hasMoreOutbox.set(outboxMore);
      hasMore.set(inboxMore || outboxMore);
      return "applied";
    };

    const isMainnetChainId = (value: unknown): boolean => {
      const parsed = typeof value === "number"
        ? value
        : Number.parseInt(String(value ?? ""), String(value ?? "").startsWith("0x") ? 16 : 10);
      return Number.isSafeInteger(parsed) && parsed === NEO_X_CHAIN_ID;
    };

    const refreshAuthorizedMailbox = async (who: string) => {
      if (disposed || !networkSupported.get() || !addressesEqual(address.get(), who)) return;
      await loadOp.run(async () => {
        try {
          if (await refreshLists(who) === "stale") return;
          if (disposed || !addressesEqual(address.get(), who)) return;
          lastStatus.set(ctx.t("statusInboxLoaded"));
          ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
        } catch (error) {
          if (disposed || !addressesEqual(address.get(), who)) return;
          const message = app.errors.messageOf(error, ctx.t("error"));
          lastStatus.set(message);
          ctx.setStatus(message, "error");
        }
      });
    };

    const unbindInjectedProvider = () => {
      if (boundProvider && accountsChangedListener) {
        boundProvider.removeListener?.("accountsChanged", accountsChangedListener);
      }
      if (boundProvider && chainChangedListener) {
        boundProvider.removeListener?.("chainChanged", chainChangedListener);
      }
      boundProvider = null;
      accountsChangedListener = null;
      chainChangedListener = null;
    };

    const handleAccountsChanged = async (value: unknown) => {
      if (disposed) return;
      const first = Array.isArray(value) ? value[0] : undefined;
      const nextAddress = isMessageRecipient(typeof first === "string" ? first : "")
        ? String(first).trim()
        : "";
      // EIP-1193 account events invalidate the old private mailbox immediately,
      // even when a provider repeats the same account after reconnecting.
      activateAddress(nextAddress, true);
      if (!nextAddress) {
        lastStatus.set(ctx.t("notConnected"));
        return;
      }
      let supported = false;
      try {
        const chainId = await boundProvider?.request({ method: "eth_chainId" });
        supported = isMainnetChainId(chainId);
      } catch {
        supported = false;
      }
      if (disposed || !addressesEqual(address.get(), nextAddress)) return;
      networkSupported.set(supported);
      if (supported) await refreshAuthorizedMailbox(nextAddress);
    };

    const handleChainChanged = async (value: unknown) => {
      if (disposed) return;
      const currentAddress = address.get();
      // A network event also invalidates all prior reads: the same account on
      // another chain must never inherit Neo X mailbox rows.
      activateAddress(currentAddress, true);
      const supported = isMainnetChainId(value);
      networkSupported.set(supported);
      if (!supported || !boundProvider) return;
      let accounts: unknown;
      try {
        accounts = await boundProvider.request({ method: "eth_accounts" });
      } catch {
        accounts = [];
      }
      if (disposed) return;
      const first = Array.isArray(accounts) ? accounts[0] : undefined;
      const nextAddress = isMessageRecipient(typeof first === "string" ? first : "")
        ? String(first).trim()
        : "";
      activateAddress(nextAddress, true);
      if (nextAddress) await refreshAuthorizedMailbox(nextAddress);
    };

    const bindInjectedProvider = () => {
      const provider = getInjectedEthereum();
      if (provider === boundProvider) return;
      unbindInjectedProvider();
      if (!provider) return;
      boundProvider = provider;
      accountsChangedListener = (value) => { void handleAccountsChanged(value); };
      chainChangedListener = (value) => { void handleChainChanged(value); };
      provider.on?.("accountsChanged", accountsChangedListener);
      provider.on?.("chainChanged", chainChangedListener);
    };

    const ensureNeoX = async (): Promise<string> => {
      // If an EVM wallet is present, prompt it to switch/add Neo X directly
      // rather than dead-ending a MetaMask user on Ethereum (or an N3-default
      // wallet exposing an EVM provider) with "switch manually". The static
      // wrong-network card is reserved for when no EVM provider exists at all.
      if (!hasEvmWallet()) {
        networkSupported.set(false);
        hasWallet.set(false);
        throw new Error(ctx.t("errorNoEvmWallet"));
      }
      hasWallet.set(true);
      bindInjectedProvider();
      // ensureEvmWallet → ensureNeoXNetwork (wallet_switchEthereumChain /
      // wallet_addEthereumChain) then connectEvm.
      // framework-exempt: EVM lane (plan §3.6) — the framework wallet/chain
      // surface is N3-only; Neo X onboarding stays on the raw chain service.
      const addr = await ctx.services.chain.ensureEvmWallet(NEO_X_MAINNET);
      networkSupported.set(true);
      if (!isMessageRecipient(addr)) {
        activateAddress("", true);
        throw new Error(ctx.t("errorInvalidWalletAccount"));
      }
      activateAddress(addr);
      bindInjectedProvider();
      return addr;
    };

    // ── actions ──────────────────────────────────────────────────────────────

    // connectAndLoad and switchToNeoX run the identical connect-then-refresh
    // flow (both dispatch names stay registered for the PlayArea buttons); the
    // shared loadOp preserves the old cross-action isLoading gate.
    const connectAndLoad = async () => {
      if (isLoading.get()) return;
      await loadOp.run(async () => {
        try {
          const addr = await ensureNeoX();
          inboxPageSize.set(PAGE_SIZE);
          outboxPageSize.set(PAGE_SIZE);
          if (await refreshLists(addr) === "stale") return;
          lastStatus.set(ctx.t("statusInboxLoaded"));
          ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
        } catch (e) {
          const msg = app.errors.messageOf(e, ctx.t("error"));
          lastStatus.set(msg);
          ctx.setStatus(msg, "error");
        }
      });
    };
    ctx.framework.actions.register("connectAndLoad", connectAndLoad);
    ctx.framework.actions.register("switchToNeoX", connectAndLoad);

    ctx.framework.actions.register("sendMessage", async () => {
      if (isSending.get()) return;
      if (pendingDelivery.get()) {
        const msg = ctx.t("statusSendPending");
        lastStatus.set(msg);
        ctx.setStatus(msg, "info");
        return;
      }
      const form = composeForm.get();
      const check = validateCompose(form);
      if (!check.ok) {
        const msg = ctx.t(check.error || "error");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        return;
      }
      if (needsPublicRevealAck(form.lockMode, Boolean(form.publicRevealAcknowledged))) {
        const msg = ctx.t("timedAcknowledge");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        return;
      }
      // The send flow owns its multi-step messaging (encrypting → sending →
      // sent) and must keep rethrowing to the dispatch layer, so the failure
      // is captured inside the operation (the framework never auto-toasts)
      // and rethrown after the run settles — the same status ordering the
      // hand-rolled isSending flag produced (busy clears before the rethrow).
      let failure: { error: unknown } | undefined;
      const result = await sendOp.run(async () => {
        lastStatus.set(ctx.t("statusEncrypting"));
        ctx.setStatus(ctx.t("statusEncrypting"), "info");
        try {
          const sender = await ensureNeoX();
          const expectedDelivery = {
            sender,
            recipient: String(form.recipient).trim(),
            unlockTime: check.unlockTime ?? 0,
          };
          const pubKey = await getOraclePublicKey(ctx.t("errorOracleKeyUnavailable"));
          let envelope: string;
          try {
            envelope = await encryptTextWithOraclePublicKey(pubKey, String(form.body ?? "").trim());
          } catch {
            throw new Error(ctx.t("errorOracleKeyUnavailable"));
          }
          const argsHex = encodeParams([
            { t: "address", v: String(form.recipient).trim() },
            { t: "bytes", v: utf8ToBytes(envelope) },
            { t: "uint", v: check.unlockTime ?? 0 },
          ]);
          lastStatus.set(ctx.t("statusSending"));
          ctx.setStatus(ctx.t("statusSending"), "info");
          // framework-exempt: EVM lane (plan §3.6) — sendMessage writes go
          // through the raw EVM invoke; the framework chain surface is N3-only.
          const tx = await ctx.services.chain.invokeEvmWithValue({
            address: MESSAGE_EVM_ADDRESS,
            selector: SELECTORS.sendMessage,
            argsHex,
            eventTopic: TOPICS.MessageSent,
            expectedFrom: sender,
            onTransactionSent: (txid) => rememberPendingDelivery({
              version: 1,
              txid,
              ...expectedDelivery,
              createdAt: Date.now(),
            }),
          });
          const messageId = String(
            (tx.event as { id?: unknown } | undefined)?.id ?? "",
          ).trim();
          if (!/^\d+$/.test(messageId)) {
            throw new Error(ctx.t("statusSendUnverified"));
          }
          lastStatus.set(ctx.t("statusVerifyingDelivery"));
          ctx.setStatus(ctx.t("statusVerifyingDelivery"), "info");
          const verified = await readMessageWithRetry(messageId);
          assertDeliveryMatches(verified, expectedDelivery);
          const senderStillActive = !disposed && addressesEqual(address.get(), sender);
          if (senderStillActive) {
            outbox.set([
              verified,
              ...outbox.get().filter((message) => message.id !== verified.id),
            ]);
          }
          const recoveryCleared = forgetPendingDelivery();
          if (senderStillActive) composeForm.set({ ...DEFAULT_FORM });
          const deliveryStatus = recoveryCleared
            ? ctx.t("statusSent")
            : ctx.t("statusDeliveryVerifiedCleanupPending");
          if (!senderStillActive) return tx;
          lastStatus.set(deliveryStatus);
          ctx.setStatus(deliveryStatus, recoveryCleared ? "success" : "info");
          try {
            if (await refreshLists(sender) === "stale") return tx;
          } catch {
            // The exact event + readback above already confirmed delivery.
            // Keep that verified row visible and ask for a later list refresh.
            lastStatus.set(ctx.t("statusSentRefreshPending"));
            ctx.setStatus(ctx.t("statusSentRefreshPending"), "info");
          }
          return tx;
        } catch (e) {
          const msg = pendingDelivery.get()
            ? ctx.t("statusSendPending")
            : e instanceof Error && e.message === EVM_ACCOUNT_CHANGED_ERROR
              ? ctx.t("errorWalletChanged")
              : app.errors.messageOf(e, ctx.t("statusFailed"));
          lastStatus.set(msg);
          ctx.setStatus(msg, "error");
          failure = { error: e };
          return undefined;
        }
      });
      if (failure) throw failure.error;
      return result;
    });

    ctx.framework.actions.register("recoverPendingDelivery", async () => {
      const pending = pendingDelivery.get();
      if (!pending || isRecovering.get()) return;
      await recoverOp.run(async () => {
        try {
          const connected = await ensureNeoX();
          if (!addressesEqual(connected, pending.sender)) {
            throw new Error(ctx.t("pendingWalletMismatch"));
          }
          const provider = getInjectedEthereum();
          if (!provider) throw new Error(ctx.t("errorNoEvmWallet"));
          const receipt = await provider.request({
            method: "eth_getTransactionReceipt",
            params: [pending.txid],
          }) as EvmReceiptView | null;
          if (!receipt) {
            const message = ctx.t("statusSendPending");
            lastStatus.set(message);
            ctx.setStatus(message, "info");
            return;
          }
          const inspection = inspectPendingReceipt(
            receipt,
            pending,
            TOPICS.MessageSent,
            MESSAGE_EVM_ADDRESS,
          );
          if (!inspection.ok) {
            if (inspection.reason === "reverted") {
              const cleared = forgetPendingDelivery();
              throw new Error(ctx.t(cleared ? "pendingTransactionFault" : "pendingFaultCleanupFailed"));
            }
            throw new Error(ctx.t(
              inspection.reason === "event-missing"
                ? "statusSendUnverified"
                : "pendingReceiptInvalid",
            ));
          }
          const verified = await readMessageWithRetry(inspection.messageId);
          assertDeliveryMatches(verified, pending);
          if (!disposed && addressesEqual(address.get(), pending.sender)) {
            outbox.set([
              verified,
              ...outbox.get().filter((message) => message.id !== verified.id),
            ]);
          }
          const recoveryCleared = forgetPendingDelivery();
          const recoveryStatus = recoveryCleared
            ? ctx.t("statusDeliveryRecovered")
            : ctx.t("statusDeliveryVerifiedCleanupPending");
          lastStatus.set(recoveryStatus);
          ctx.setStatus(recoveryStatus, recoveryCleared ? "success" : "info");
        } catch (error) {
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          lastStatus.set(message);
          ctx.setStatus(message, "error");
        }
      });
    });

    ctx.framework.actions.register("clearStalePendingDelivery", async () => {
      const pending = pendingDelivery.get();
      if (!pending) return;
      try {
        if (!pendingDeliveryIsStale(pending)) {
          throw new Error(ctx.t("pendingTooRecentToClear"));
        }
        const connected = await ensureNeoX();
        if (!addressesEqual(connected, pending.sender)) {
          throw new Error(ctx.t("pendingWalletMismatch"));
        }
        const provider = getInjectedEthereum();
        if (!provider) throw new Error(ctx.t("errorNoEvmWallet"));
        // Age alone cannot prove that a broadcast disappeared. Only release the
        // retry lock when both the canonical receipt and transaction lookup are
        // absent; an RPC failure keeps the recovery record intact.
        const [receipt, transaction] = await Promise.all([
          provider.request({ method: "eth_getTransactionReceipt", params: [pending.txid] }),
          provider.request({ method: "eth_getTransactionByHash", params: [pending.txid] }),
        ]);
        if (receipt !== null || transaction !== null) {
          throw new Error(ctx.t("pendingTransactionStillKnown"));
        }
        if (!forgetPendingDelivery()) {
          throw new Error(ctx.t("pendingCleanupFailed"));
        }
        lastStatus.set(ctx.t("pendingCleared"));
        ctx.setStatus(ctx.t("pendingCleared"), "info");
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        lastStatus.set(message);
        ctx.setStatus(message, "error");
      }
    });

    // Recipient-only reveal: prove recipient via wallet signature, decrypt
    // off-chain through the oracle edge. Plaintext is shown locally only.
    ctx.framework.actions.register("revealRecipient", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyIds.get().includes(msg.id)) return;
      await reveals.opFor(msg.id).run(async () => {
        lastStatus.set(ctx.t("statusRevealing"));
        ctx.setStatus(ctx.t("statusRevealing"), "info");
        try {
          const addr = await ensureNeoX();
          const revealRequestId = mailboxRequestId;
          const canonical = await readMessage(msg.id);
          if (
            canonical.unlockTime !== 0 ||
            canonical.revealed ||
            !addressesEqual(addr, canonical.recipient)
          ) {
            throw new Error(ctx.t("errorNotRecipient"));
          }
          // framework-exempt: Morpheus confidential reveal protocol (plan
          // §3.6) — the recipient proves themselves with an EVM personal_sign
          // over the worker's byte-identical statement and the oracle edge
          // decrypts off-chain; app.oracle does not cover this protocol.
          const issuedAt = Math.floor(Date.now() / 1000);
          const statement = buildRevealStatement(NEO_X_CHAIN_ID, MESSAGE_EVM_ADDRESS, canonical.id, issuedAt);
          const signature = await evmPersonalSign(statement, addr);
          const res = await fetchWithTimeout("/api/morpheus/oracle/message-reveal", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ chain: "neox", messageId: canonical.id, signature, issuedAt }),
          });
          let body: {
            plaintext?: string;
          } = {};
          try {
            const parsed = JSON.parse(await res.text()) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("invalid reveal payload");
            }
            body = parsed as typeof body;
          } catch {
            throw new Error(ctx.t("errorOracleRevealUnavailable"));
          }
          if (
            !res.ok ||
            typeof body.plaintext !== "string" ||
            body.plaintext.length === 0 ||
            body.plaintext.length > MAX_BODY_LENGTH
          ) {
            throw new Error(ctx.t("errorOracleRevealUnavailable"));
          }
          if (
            disposed ||
            revealRequestId !== mailboxRequestId ||
            !addressesEqual(address.get(), addr)
          ) {
            throw new Error(EVM_ACCOUNT_CHANGED_ERROR);
          }
          const plaintext = body.plaintext;
          // Show plaintext locally without writing it on-chain, and cache it so a
          // refresh does not force another signature + oracle round-trip.
          cachePlaintext(app.storage.local, canonical.id, canonical.recipient, plaintext);
          inbox.set(
            inbox.get().map((r) =>
              // Recipient-only decrypt stays device-local. Do not mutate the
              // contract's public `revealed` flag or label this as on-chain.
              r.id === canonical.id ? { ...r, plaintext } : r,
            ),
          );
          lastStatus.set(ctx.t("statusPrivateOpened"));
          ctx.setStatus(ctx.t("statusPrivateOpened"), "success");
        } catch (e) {
          const m = e instanceof Error && e.message === EVM_ACCOUNT_CHANGED_ERROR
            ? ctx.t("errorWalletChanged")
            : app.errors.messageOf(e, ctx.t("statusFailed"));
          lastStatus.set(m);
          ctx.setStatus(m, "error");
        }
      });
    });

    // Time-locked reveal: trigger the on-chain requestReveal; the relayer
    // decrypts and posts plaintext on-chain. Poll until revealed.
    const patchRevealed = (id: string, updated: MessageView) => {
      inbox.set(inbox.get().map((r) => (r.id === id ? updated : r)));
      outbox.set(outbox.get().map((r) => (r.id === id ? updated : r)));
      pendingRevealIds.set(pendingRevealIds.get().filter((pendingId) => pendingId !== id));
    };

    // After the foreground poll window, keep checking at a low frequency (every
    // 30s for up to 10 min) so a slow relayer's reveal patches the row without a
    // manual Refresh. Stops on the first revealed read.
    const scheduleBackgroundRecheck = (
      id: string,
      expectedAddress: string,
      expectedRequestId: number,
    ) => {
      if (backgroundRechecks.has(id)) return;
      backgroundRechecks.add(id);
      let attempts = 0;
      const scheduleTick = () => {
        if (disposed || expectedRequestId !== mailboxRequestId) {
          backgroundRechecks.delete(id);
          return;
        }
        const timer = globalThis.setTimeout(() => {
          backgroundTimers.delete(timer);
          void tick();
        }, 30000);
        backgroundTimers.add(timer);
      };
      const tick = async () => {
        if (
          disposed ||
          expectedRequestId !== mailboxRequestId ||
          !addressesEqual(address.get(), expectedAddress)
        ) {
          backgroundRechecks.delete(id);
          return;
        }
        if (attempts >= 20) {
          backgroundRechecks.delete(id);
          pendingRevealIds.set(pendingRevealIds.get().filter((pendingId) => pendingId !== id));
          return;
        }
        attempts += 1;
        try {
          const updated = await readMessage(id);
          if (updated?.revealed) {
            patchRevealed(id, updated);
            backgroundRechecks.delete(id);
            lastStatus.set(ctx.t("statusRevealed"));
            ctx.setStatus(ctx.t("statusRevealed"), "success");
            return;
          }
        } catch {
          /* transient read error — try again next tick */
        }
        scheduleTick();
      };
      scheduleTick();
    };

    ctx.framework.actions.register("requestTimedReveal", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyIds.get().includes(msg.id)) return;
      await reveals.opFor(msg.id).run(async () => {
        lastStatus.set(ctx.t("statusRequestingReveal"));
        ctx.setStatus(ctx.t("statusRequestingReveal"), "info");
        try {
          const requester = await ensureNeoX();
          const revealRequestId = mailboxRequestId;
          const canonical = await readMessage(msg.id);
          if (canonical.revealed) {
            patchRevealed(msg.id, canonical);
            lastStatus.set(ctx.t("statusRevealed"));
            ctx.setStatus(ctx.t("statusRevealed"), "success");
            return;
          }
          if (canonical.unlockTime <= 0 || Math.floor(Date.now() / 1000) < canonical.unlockTime) {
            throw new Error(ctx.t("notUnlockedYet"));
          }
          // framework-exempt: EVM lane (plan §3.6) — requestReveal writes go
          // through the raw EVM invoke; the framework chain surface is N3-only.
          const requestTx = await ctx.services.chain.invokeEvmWithValue({
            address: MESSAGE_EVM_ADDRESS,
            selector: SELECTORS.requestReveal,
            uintArgs: [msg.id],
            eventTopic: TOPICS.RevealRequested,
            expectedFrom: requester,
          });
          const requestedId = String(
            (requestTx.event as { id?: unknown } | undefined)?.id ?? "",
          ).trim();
          if (requestedId !== msg.id) {
            throw new Error(ctx.t("statusRevealRequestUnverified"));
          }
          if (
            disposed ||
            revealRequestId !== mailboxRequestId ||
            !addressesEqual(address.get(), requester)
          ) return;
          if (!pendingRevealIds.get().includes(msg.id)) {
            pendingRevealIds.set([...pendingRevealIds.get(), msg.id]);
          }
          lastStatus.set(ctx.t("statusWaitingReveal"));
          ctx.setStatus(ctx.t("statusWaitingReveal"), "info");
          for (let i = 0; i < 36; i += 1) {
            await sleep(5000);
            if (
              disposed ||
              revealRequestId !== mailboxRequestId ||
              !addressesEqual(address.get(), requester)
            ) return;
            const updated = await tryReadMessage(msg.id);
            if (updated?.revealed) {
              patchRevealed(msg.id, updated);
              lastStatus.set(ctx.t("statusRevealed"));
              ctx.setStatus(ctx.t("statusRevealed"), "success");
              return;
            }
          }
          lastStatus.set(ctx.t("statusRevealPending"));
          ctx.setStatus(ctx.t("statusRevealPending"), "info");
          // The relayer is taking >3 min: keep checking in the background so the
          // row patches itself instead of going stale until a manual Refresh.
          scheduleBackgroundRecheck(msg.id, requester, revealRequestId);
        } catch (e) {
          const m = e instanceof Error && e.message === EVM_ACCOUNT_CHANGED_ERROR
            ? ctx.t("errorWalletChanged")
            : app.errors.messageOf(e, ctx.t("statusFailed"));
          lastStatus.set(m);
          ctx.setStatus(m, "error");
        }
      });
    });

    ctx.framework.actions.register("loadOlder", async (kind: unknown) => {
      const who = address.get();
      if (!who || isLoading.get()) return;
      const mailbox = kind === "outbox" ? "outbox" : "inbox";
      const pageLimit = mailbox === "outbox" ? outboxPageSize : inboxPageSize;
      await loadOp.run(async () => {
        const previousLimit = pageLimit.get();
        try {
          pageLimit.set(previousLimit + PAGE_SIZE);
          if (await refreshLists(who) === "stale") return;
          lastStatus.set(ctx.t("statusInboxLoaded"));
          ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
        } catch (e) {
          pageLimit.set(previousLimit);
          const msg = app.errors.messageOf(e, ctx.t("error"));
          lastStatus.set(msg);
          ctx.setStatus(msg, "error");
        }
      });
    });

    ctx.framework.actions.register("updateCompose", async (patch: unknown) => {
      setForm((patch ?? {}) as Partial<ComposeForm>);
    });

    return {
      state: {
        address,
        networkSupported,
        hasWallet,
        inbox,
        outbox,
        isLoading,
        isSending,
        isRecovering,
        busyIds,
        hasMore,
        hasMoreInbox,
        hasMoreOutbox,
        lastStatus,
        composeForm,
        pendingDelivery,
        pendingStorageHealthy,
        pendingRevealIds,
      },
      loadData: async () => {
        try {
          hasWallet.set(hasEvmWallet());
          bindInjectedProvider();
          // framework-exempt: EVM lane (plan §3.6) — network detection for the
          // Neo X gate stays on the raw chain service (framework is N3-only).
          const net = await ctx.services.chain.detectNetwork();
          const supported = isSupportedMessageNetwork(net);
          networkSupported.set(supported);
          if (!supported) return;
          // Auto-load if a wallet is already authorized (no prompt).
          const { getEvmAccount } = await import("@shared/utils/evm-chain");
          const addr = await getEvmAccount();
          if (isMessageRecipient(addr)) {
            activateAddress(addr);
            inboxPageSize.set(PAGE_SIZE);
            outboxPageSize.set(PAGE_SIZE);
            try {
              if (await refreshLists(addr) === "stale") return;
              lastStatus.set(ctx.t("statusInboxLoaded"));
            } catch (error) {
              const message = app.errors.messageOf(error, ctx.t("error"));
              lastStatus.set(message);
              ctx.setStatus(message, "error");
            }
          } else if (addr) {
            activateAddress("", true);
            const message = ctx.t("errorInvalidWalletAccount");
            lastStatus.set(message);
            ctx.setStatus(message, "error");
          }
        } catch {
          /* leave the connect prompt to the user */
        }
      },
      cleanup: () => {
        disposed = true;
        mailboxRequestId += 1;
        unbindInjectedProvider();
        cancelBackgroundWork();
        reveals.cleanup();
      },
    };
  },
});
