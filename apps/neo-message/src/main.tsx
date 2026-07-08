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
  decodeUintArray,
  decodeMessageStruct,
  utf8ToBytes,
  hasEvmWallet,
} from "@shared/utils/evm-chain";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { sleep } from "@shared/utils/format";
import { encryptTextWithOraclePublicKey } from "@shared/utils/morpheus-confidential-envelope";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  MESSAGE_EVM_ADDRESS,
  NEO_X_MAINNET,
  NEO_X_CHAIN_ID,
  ORACLE_EDGE_BASE,
  SELECTORS,
  TOPICS,
  buildRevealStatement,
  validateCompose,
  needsPublicRevealAck,
  addressesEqual,
  type ComposeForm,
  type MessageView,
} from "./message-logic";
import { createRevealOperations, operationBusyFlag } from "./operation-busy";
import { cachePlaintext, overlayCachedPlaintext } from "./plaintext-cache";

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
// messages. Re-fetch every ORACLE_KEY_TTL_MS so a rotation is picked up; tolerate a
// transient fetch failure by reusing the last good key.
const ORACLE_KEY_TTL_MS = 5 * 60 * 1000;
let cachedOraclePublicKey = "";
let cachedOraclePublicKeyAt = 0;
// framework-exempt: Morpheus confidential envelope lane (plan §3.6) — this
// public-key fetch feeds the confidential seal protocol (the reveal's
// encrypt-side counterpart), which app.oracle does not cover.
async function getOraclePublicKey(): Promise<string> {
  if (cachedOraclePublicKey && Date.now() - cachedOraclePublicKeyAt < ORACLE_KEY_TTL_MS) {
    return cachedOraclePublicKey;
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(`${ORACLE_EDGE_BASE}/oracle/public-key`, {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    if (cachedOraclePublicKey) return cachedOraclePublicKey;
    throw err;
  }
  if (!res.ok) {
    if (cachedOraclePublicKey) return cachedOraclePublicKey;
    throw new Error(`oracle public key unavailable (${res.status})`);
  }
  const body = (await res.json()) as { public_key?: string };
  if (!body.public_key) {
    if (cachedOraclePublicKey) return cachedOraclePublicKey;
    throw new Error("oracle returned no public key");
  }
  cachedOraclePublicKey = body.public_key;
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
    const isLoading = operationBusyFlag(loadOp);
    const isSending = operationBusyFlag(sendOp);
    // Ids whose reveal is in flight — per-row so one slow poll does not disable
    // every other reveal button.
    const reveals = createRevealOperations((key) => app.operations.create(key));
    const busyIds = reveals.busyIds;
    // Whether more inbox/outbox ids exist beyond the loaded page.
    const hasMore = createObservable(false);
    const pageSize = createObservable(PAGE_SIZE);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const composeForm = createObservable<ComposeForm>({ ...DEFAULT_FORM });

    const setForm = (patch: Partial<ComposeForm>) => composeForm.set({ ...composeForm.get(), ...patch });

    const readMessage = async (id: string): Promise<MessageView | null> => {
      try {
        const raw = await evmCall(MESSAGE_EVM_ADDRESS, SELECTORS.getMessage, [id]);
        const m = decodeMessageStruct(raw);
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
      } catch {
        return null;
      }
    };

    const loadIdsFor = async (
      selector: string,
      who: string,
    ): Promise<{ rows: MessageView[]; total: number }> => {
      const argsHex = encodeParams([{ t: "address", v: who }]);
      const raw = await evmCallEncoded(MESSAGE_EVM_ADDRESS, selector, argsHex);
      const allIds = decodeUintArray(raw).map((n) => n.toString());
      // Slice to the newest page before fetching (ids are monotonic) so we never
      // fan out an unbounded number of getMessage calls.
      const limit = pageSize.get();
      const pageIds = [...allIds].sort((a, b) => Number(b) - Number(a)).slice(0, limit);
      const fetched = await Promise.all(pageIds.map((id) => readMessage(id)));
      const rows = fetched
        .filter((r): r is MessageView => r !== null)
        .sort((a, b) => Number(b.id) - Number(a.id));
      return { rows, total: allIds.length };
    };

    const refreshLists = async (who: string) => {
      const [inboxResult, outboxResult] = await Promise.all([
        loadIdsFor(SELECTORS.inboxOf, who),
        loadIdsFor(SELECTORS.outboxOf, who),
      ]);
      // Overlay any device-cached recipient-only plaintext back onto rows so a
      // just-decrypted message survives a refresh without a fresh signature +
      // oracle round-trip (only for rows the connected wallet can decrypt).
      inbox.set(overlayCachedPlaintext(app.storage.local, inboxResult.rows, who));
      outbox.set(outboxResult.rows);
      const limit = pageSize.get();
      hasMore.set(inboxResult.total > limit || outboxResult.total > limit);
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
      // ensureEvmWallet → ensureNeoXNetwork (wallet_switchEthereumChain /
      // wallet_addEthereumChain) then connectEvm.
      // framework-exempt: EVM lane (plan §3.6) — the framework wallet/chain
      // surface is N3-only; Neo X onboarding stays on the raw chain service.
      const addr = await ctx.services.chain.ensureEvmWallet(NEO_X_MAINNET);
      networkSupported.set(true);
      address.set(addr);
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
          await refreshLists(addr);
          lastStatus.set(ctx.t("statusInboxLoaded"));
          ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
        } catch (e) {
          const msg = e instanceof Error ? e.message : ctx.t("error");
          lastStatus.set(msg);
          ctx.setStatus(msg, "error");
        }
      });
    };
    ctx.framework.actions.register("connectAndLoad", connectAndLoad);
    ctx.framework.actions.register("switchToNeoX", connectAndLoad);

    ctx.framework.actions.register("sendMessage", async () => {
      if (isSending.get()) return;
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
          const pubKey = await getOraclePublicKey();
          const envelope = await encryptTextWithOraclePublicKey(pubKey, String(form.body ?? "").trim());
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
          });
          composeForm.set({ ...DEFAULT_FORM });
          lastStatus.set(ctx.t("statusSent"));
          ctx.setStatus(ctx.t("statusSent"), "success");
          await refreshLists(sender);
          return tx;
        } catch (e) {
          const msg = e instanceof Error ? e.message : ctx.t("statusFailed");
          lastStatus.set(msg);
          ctx.setStatus(msg, "error");
          failure = { error: e };
          return undefined;
        }
      });
      if (failure) throw failure.error;
      return result;
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
          if (!addressesEqual(addr, msg.recipient)) {
            throw new Error(ctx.t("errorNotRecipient"));
          }
          // framework-exempt: Morpheus confidential reveal protocol (plan
          // §3.6) — the recipient proves themselves with an EVM personal_sign
          // over the worker's byte-identical statement and the oracle edge
          // decrypts off-chain; app.oracle does not cover this protocol.
          const issuedAt = Math.floor(Date.now() / 1000);
          const statement = buildRevealStatement(NEO_X_CHAIN_ID, MESSAGE_EVM_ADDRESS, msg.id, issuedAt);
          const signature = await evmPersonalSign(statement);
          const res = await fetchWithTimeout(`${ORACLE_EDGE_BASE}/oracle/message-reveal`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ chain: "neox", messageId: msg.id, signature, issuedAt }),
          });
          const body = (await res.json()) as { plaintext?: string; error?: string };
          if (!res.ok || typeof body.plaintext !== "string") {
            throw new Error(body.error || ctx.t("statusFailed"));
          }
          const plaintext = body.plaintext;
          // Show plaintext locally without writing it on-chain, and cache it so a
          // refresh does not force another signature + oracle round-trip.
          cachePlaintext(app.storage.local, msg.id, msg.recipient, plaintext);
          inbox.set(
            inbox.get().map((r) =>
              r.id === msg.id ? { ...r, plaintext, revealed: true } : r,
            ),
          );
          lastStatus.set(ctx.t("statusRevealed"));
          ctx.setStatus(ctx.t("statusRevealed"), "success");
        } catch (e) {
          const m = e instanceof Error ? e.message : ctx.t("statusFailed");
          lastStatus.set(m);
          ctx.setStatus(m, "error");
        }
      });
    });

    // Time-locked reveal: trigger the on-chain requestReveal; the relayer
    // decrypts and posts plaintext on-chain. Poll until revealed.
    // Track ids already under a background recheck so we never stack timers.
    const backgroundRechecks = new Set<string>();

    const patchRevealed = (id: string, updated: MessageView) => {
      inbox.set(inbox.get().map((r) => (r.id === id ? updated : r)));
      outbox.set(outbox.get().map((r) => (r.id === id ? updated : r)));
    };

    // After the foreground poll window, keep checking at a low frequency (every
    // 30s for up to 10 min) so a slow relayer's reveal patches the row without a
    // manual Refresh. Stops on the first revealed read.
    const scheduleBackgroundRecheck = (id: string) => {
      if (backgroundRechecks.has(id)) return;
      backgroundRechecks.add(id);
      let attempts = 0;
      const tick = async () => {
        if (attempts >= 20) {
          backgroundRechecks.delete(id);
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
        setTimeout(() => void tick(), 30000);
      };
      setTimeout(() => void tick(), 30000);
    };

    ctx.framework.actions.register("requestTimedReveal", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyIds.get().includes(msg.id)) return;
      await reveals.opFor(msg.id).run(async () => {
        lastStatus.set(ctx.t("statusRequestingReveal"));
        ctx.setStatus(ctx.t("statusRequestingReveal"), "info");
        try {
          await ensureNeoX();
          // framework-exempt: EVM lane (plan §3.6) — requestReveal writes go
          // through the raw EVM invoke; the framework chain surface is N3-only.
          await ctx.services.chain.invokeEvmWithValue({
            address: MESSAGE_EVM_ADDRESS,
            selector: SELECTORS.requestReveal,
            uintArgs: [msg.id],
            eventTopic: TOPICS.RevealRequested,
          });
          lastStatus.set(ctx.t("statusWaitingReveal"));
          ctx.setStatus(ctx.t("statusWaitingReveal"), "info");
          for (let i = 0; i < 36; i += 1) {
            await sleep(5000);
            const updated = await readMessage(msg.id);
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
          scheduleBackgroundRecheck(msg.id);
        } catch (e) {
          const m = e instanceof Error ? e.message : ctx.t("statusFailed");
          lastStatus.set(m);
          ctx.setStatus(m, "error");
        }
      });
    });

    ctx.framework.actions.register("loadOlder", async () => {
      const who = address.get();
      if (!who || isLoading.get()) return;
      await loadOp.run(async () => {
        try {
          pageSize.set(pageSize.get() + PAGE_SIZE);
          await refreshLists(who);
        } catch (e) {
          const msg = e instanceof Error ? e.message : ctx.t("error");
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
        busyIds,
        hasMore,
        lastStatus,
        composeForm,
      },
      loadData: async () => {
        try {
          hasWallet.set(hasEvmWallet());
          // framework-exempt: EVM lane (plan §3.6) — network detection for the
          // Neo X gate stays on the raw chain service (framework is N3-only).
          const net = await ctx.services.chain.detectNetwork();
          const supported = ctx.services.chain.isEvmNetwork(net);
          networkSupported.set(supported);
          if (!supported) return;
          // Auto-load if a wallet is already authorized (no prompt).
          const { getEvmAccount } = await import("@shared/utils/evm-chain");
          const addr = await getEvmAccount();
          if (addr) {
            address.set(addr);
            await refreshLists(addr);
          }
        } catch {
          /* leave the connect prompt to the user */
        }
      },
    };
  },
});
