/**
 * Neo Message — Entry Point (React / OS Services Pattern)
 *
 * Encrypted + time-locked messaging on Neo X, backed by MiniAppMessageEVM and
 * the Morpheus confidential oracle. See message-logic.ts for the model.
 */

import { createObservable, defineMiniApp } from "@shared/react";
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
import { encryptTextWithOraclePublicKey } from "@shared/utils/morpheus-confidential-envelope";
import { safeReadJSON, safeWriteJSON } from "@shared/utils/safe-storage";
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
  addressesEqual,
  type ComposeForm,
  type MessageView,
} from "./message-logic";

const appId = "miniapp-neo-message";

const DEFAULT_FORM: ComposeForm = { recipient: "", body: "", lockMode: "recipient", revealDate: "" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cap the per-refresh getMessage fan-out: ids are monotonically increasing, so
// the newest PAGE_SIZE rows are the relevant ones; a heavy account would
// otherwise fire hundreds of parallel wallet-provider RPCs on every refresh.
const PAGE_SIZE = 50;

// Recipient-only plaintext is decrypted off-chain (never written on-chain), so
// a refresh re-reads chain state with revealed=false and wipes it. Persist the
// decrypted plaintext on-device, keyed by contract:id:recipient, and overlay it
// back onto rows where the connected wallet is the recipient.
const PLAINTEXT_KEY = `${MESSAGE_EVM_ADDRESS.toLowerCase()}:plaintext:v1`;

function plaintextCacheKey(id: string, recipient: string): string {
  return `${id}:${recipient.toLowerCase()}`;
}

function readPlaintextCache(): Record<string, string> {
  const raw = safeReadJSON<Record<string, string>>(PLAINTEXT_KEY);
  return raw && typeof raw === "object" ? raw : {};
}

function cachePlaintext(id: string, recipient: string, plaintext: string): void {
  const cache = readPlaintextCache();
  cache[plaintextCacheKey(id, recipient)] = plaintext;
  safeWriteJSON(PLAINTEXT_KEY, cache);
}

let cachedOraclePublicKey = "";
async function getOraclePublicKey(): Promise<string> {
  if (cachedOraclePublicKey) return cachedOraclePublicKey;
  const res = await fetchWithTimeout(`${ORACLE_EDGE_BASE}/oracle/public-key`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`oracle public key unavailable (${res.status})`);
  const body = (await res.json()) as { public_key?: string };
  if (!body.public_key) throw new Error("oracle returned no public key");
  cachedOraclePublicKey = body.public_key;
  return cachedOraclePublicKey;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const address = createObservable("");
    const networkSupported = createObservable(false);
    const hasWallet = createObservable(hasEvmWallet());
    const inbox = createObservable<MessageView[]>([]);
    const outbox = createObservable<MessageView[]>([]);
    const isLoading = createObservable(false);
    const isSending = createObservable(false);
    // Ids whose reveal is in flight — per-row so one slow poll does not disable
    // every other reveal button.
    const busyIds = createObservable<string[]>([]);
    // Whether more inbox/outbox ids exist beyond the loaded page.
    const hasMore = createObservable(false);
    const pageSize = createObservable(PAGE_SIZE);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const composeForm = createObservable<ComposeForm>({ ...DEFAULT_FORM });

    const setForm = (patch: Partial<ComposeForm>) => composeForm.set({ ...composeForm.get(), ...patch });

    const addBusy = (id: string) => {
      if (!busyIds.get().includes(id)) busyIds.set([...busyIds.get(), id]);
    };
    const removeBusy = (id: string) => {
      busyIds.set(busyIds.get().filter((x) => x !== id));
    };

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

    // Overlay any device-cached recipient-only plaintext back onto a row so a
    // just-decrypted message survives a refresh without a fresh signature +
    // oracle round-trip (only for rows the connected wallet can decrypt).
    const overlayCachedPlaintext = (rows: MessageView[], who: string): MessageView[] => {
      const cache = readPlaintextCache();
      return rows.map((row) => {
        if (row.revealed || row.plaintext || !addressesEqual(who, row.recipient)) {
          return row;
        }
        const cached = cache[plaintextCacheKey(row.id, row.recipient)];
        return cached ? { ...row, plaintext: cached, revealed: true } : row;
      });
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
      inbox.set(overlayCachedPlaintext(inboxResult.rows, who));
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
      const addr = await ctx.services.chain.ensureEvmWallet(NEO_X_MAINNET);
      networkSupported.set(true);
      address.set(addr);
      return addr;
    };

    // ── actions ──────────────────────────────────────────────────────────────

    ctx.registerAction("connectAndLoad", async () => {
      if (isLoading.get()) return;
      isLoading.set(true);
      try {
        const addr = await ensureNeoX();
        await refreshLists(addr);
        lastStatus.set(ctx.t("statusInboxLoaded"));
        ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : ctx.t("error");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
      } finally {
        isLoading.set(false);
      }
    });

    ctx.registerAction("sendMessage", async () => {
      if (isSending.get()) return;
      const form = composeForm.get();
      const check = validateCompose(form);
      if (!check.ok) {
        const msg = ctx.t(check.error || "error");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        return;
      }
      isSending.set(true);
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
        const result = await ctx.services.chain.invokeEvmWithValue({
          address: MESSAGE_EVM_ADDRESS,
          selector: SELECTORS.sendMessage,
          argsHex,
          eventTopic: TOPICS.MessageSent,
        });
        composeForm.set({ ...DEFAULT_FORM });
        lastStatus.set(ctx.t("statusSent"));
        ctx.setStatus(ctx.t("statusSent"), "success");
        await refreshLists(sender);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : ctx.t("statusFailed");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw e;
      } finally {
        isSending.set(false);
      }
    });

    // Recipient-only reveal: prove recipient via wallet signature, decrypt
    // off-chain through the oracle edge. Plaintext is shown locally only.
    ctx.registerAction("revealRecipient", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyIds.get().includes(msg.id)) return;
      addBusy(msg.id);
      lastStatus.set(ctx.t("statusRevealing"));
      ctx.setStatus(ctx.t("statusRevealing"), "info");
      try {
        const addr = await ensureNeoX();
        if (!addressesEqual(addr, msg.recipient)) {
          throw new Error(ctx.t("errorNotRecipient"));
        }
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
        cachePlaintext(msg.id, msg.recipient, plaintext);
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
      } finally {
        removeBusy(msg.id);
      }
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

    ctx.registerAction("requestTimedReveal", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyIds.get().includes(msg.id)) return;
      addBusy(msg.id);
      lastStatus.set(ctx.t("statusRequestingReveal"));
      ctx.setStatus(ctx.t("statusRequestingReveal"), "info");
      try {
        await ensureNeoX();
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
      } finally {
        removeBusy(msg.id);
      }
    });

    ctx.registerAction("switchToNeoX", async () => {
      if (isLoading.get()) return;
      isLoading.set(true);
      try {
        const addr = await ensureNeoX();
        await refreshLists(addr);
        lastStatus.set(ctx.t("statusInboxLoaded"));
        ctx.setStatus(ctx.t("statusInboxLoaded"), "success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : ctx.t("error");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
      } finally {
        isLoading.set(false);
      }
    });

    ctx.registerAction("loadOlder", async () => {
      const who = address.get();
      if (!who || isLoading.get()) return;
      isLoading.set(true);
      try {
        pageSize.set(pageSize.get() + PAGE_SIZE);
        await refreshLists(who);
      } catch (e) {
        const msg = e instanceof Error ? e.message : ctx.t("error");
        lastStatus.set(msg);
        ctx.setStatus(msg, "error");
      } finally {
        isLoading.set(false);
      }
    });

    ctx.registerAction("updateCompose", async (patch: unknown) => {
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
