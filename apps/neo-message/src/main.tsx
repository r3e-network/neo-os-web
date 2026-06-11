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
} from "@shared/utils/evm-chain";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
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
  addressesEqual,
  type ComposeForm,
  type MessageView,
} from "./message-logic";

const appId = "miniapp-neo-message";

const DEFAULT_FORM: ComposeForm = { recipient: "", body: "", lockMode: "recipient", revealDate: "" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const inbox = createObservable<MessageView[]>([]);
    const outbox = createObservable<MessageView[]>([]);
    const isLoading = createObservable(false);
    const isSending = createObservable(false);
    const busyId = createObservable(""); // message id currently revealing
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

    const loadIdsFor = async (selector: string, who: string): Promise<MessageView[]> => {
      const argsHex = encodeParams([{ t: "address", v: who }]);
      const raw = await evmCallEncoded(MESSAGE_EVM_ADDRESS, selector, argsHex);
      const ids = decodeUintArray(raw).map((n) => n.toString());
      const rows = await Promise.all(ids.map((id) => readMessage(id)));
      // newest first
      return rows.filter((r): r is MessageView => r !== null).sort((a, b) => Number(b.id) - Number(a.id));
    };

    const refreshLists = async (who: string) => {
      const [inboxRows, outboxRows] = await Promise.all([
        loadIdsFor(SELECTORS.inboxOf, who),
        loadIdsFor(SELECTORS.outboxOf, who),
      ]);
      inbox.set(inboxRows);
      outbox.set(outboxRows);
    };

    const ensureNeoX = async (): Promise<string> => {
      const net = await ctx.services.chain.detectNetwork();
      if (!ctx.services.chain.isEvmNetwork(net)) {
        networkSupported.set(false);
        throw new Error(ctx.t("errorWrongNetwork"));
      }
      networkSupported.set(true);
      const addr = await ctx.services.chain.ensureEvmWallet(NEO_X_MAINNET);
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
      if (!msg?.id || busyId.get()) return;
      busyId.set(msg.id);
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
        // Show plaintext locally without writing it on-chain.
        inbox.set(
          inbox.get().map((r) =>
            r.id === msg.id ? { ...r, plaintext: body.plaintext as string, revealed: true } : r,
          ),
        );
        lastStatus.set(ctx.t("statusRevealed"));
        ctx.setStatus(ctx.t("statusRevealed"), "success");
      } catch (e) {
        const m = e instanceof Error ? e.message : ctx.t("statusFailed");
        lastStatus.set(m);
        ctx.setStatus(m, "error");
      } finally {
        busyId.set("");
      }
    });

    // Time-locked reveal: trigger the on-chain requestReveal; the relayer
    // decrypts and posts plaintext on-chain. Poll until revealed.
    ctx.registerAction("requestTimedReveal", async (row: unknown) => {
      const msg = row as MessageView;
      if (!msg?.id || busyId.get()) return;
      busyId.set(msg.id);
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
            inbox.set(inbox.get().map((r) => (r.id === msg.id ? updated : r)));
            outbox.set(outbox.get().map((r) => (r.id === msg.id ? updated : r)));
            lastStatus.set(ctx.t("statusRevealed"));
            ctx.setStatus(ctx.t("statusRevealed"), "success");
            return;
          }
        }
        lastStatus.set(ctx.t("statusRevealPending"));
        ctx.setStatus(ctx.t("statusRevealPending"), "info");
      } catch (e) {
        const m = e instanceof Error ? e.message : ctx.t("statusFailed");
        lastStatus.set(m);
        ctx.setStatus(m, "error");
      } finally {
        busyId.set("");
      }
    });

    ctx.registerAction("updateCompose", async (patch: unknown) => {
      setForm((patch ?? {}) as Partial<ComposeForm>);
    });

    return {
      state: {
        address,
        networkSupported,
        inbox,
        outbox,
        isLoading,
        isSending,
        busyId,
        lastStatus,
        composeForm,
      },
      loadData: async () => {
        try {
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
