/**
 * useSignAnything — Domain logic for the Neo Sign Anything miniapp (React)
 *
 * Receives ChainService + EventBus + ClipboardService from PlatformServices
 * and StorageProxy from OS services. Chain calls target the native GAS
 * contract (external) for broadcast, so they stay on ChainService.
 * Session sign/broadcast counters are persisted via OS storage.
 */

import { createObservable } from "@shared/react/context";
import type { ChainService, EventBus, ClipboardService } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const MAX_MESSAGE_BYTES = 1024;

const getMessageBytes = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length;
};

export interface UseSignAnythingOptions {
  chain: ChainService;
  eventBus: EventBus;
  clipboard: ClipboardService;
  storage: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSignAnything({ chain, eventBus, clipboard, storage, t }: UseSignAnythingOptions) {
  const message = createObservable("");
  const signature = createObservable("");
  const txHash = createObservable("");
  const isSigning = createObservable(false);
  const isBroadcasting = createObservable(false);
  const signCount = createObservable(0);
  const broadcastCount = createObservable(0);

  const signMessage = async (msg: string) => {
    if (!msg) return;
    isSigning.set(true);
    signature.set("");
    txHash.set("");
    try {
      const result = await chain.signMessage(msg);

      // Parse the result — may be an object { signature, publicKey, data } or string
      if (typeof result === "string") {
        signature.set(result);
      } else if (result && typeof result === "object") {
        const resultRecord = result as Record<string, unknown>;
        if (resultRecord.signature) {
          signature.set(String(resultRecord.signature));
        } else if (resultRecord.data) {
          signature.set(String(resultRecord.data));
        } else {
          try { signature.set(JSON.stringify(result)); }
          catch { signature.set(String(result)); }
        }
      } else {
        try { signature.set(JSON.stringify(result)); }
        catch { signature.set(String(result)); }
      }

      signCount.set(signCount.get() + 1);
      storage.set("signCount", signCount.get()).catch(() => {});
      eventBus.emit("sign:success", { action: t("signBtn") });
    } catch (e) {
      eventBus.emit("sign:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isSigning.set(false);
    }
  };

  /**
   * Broadcast a message on-chain via a 0-GAS self-transfer with message data.
   */
  const broadcastMessage = async (msg: string) => {
    if (!msg) return;
    if (getMessageBytes(msg) > MAX_MESSAGE_BYTES) {
      throw new Error(t("messageTooLong"));
    }
    isBroadcasting.set(true);
    txHash.set("");
    signature.set("");
    try {
      await chain.ensureWallet();
      const walletAddress = chain.address.get() as string;

      const result = await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: walletAddress },
          { type: "Hash160", value: walletAddress },
          { type: "Integer", value: "0" },
          { type: "String", value: msg },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      txHash.set(result.txid || t("txPending"));
      broadcastCount.set(broadcastCount.get() + 1);
      storage.set("broadcastCount", broadcastCount.get()).catch(() => {});
      eventBus.emit("broadcast:success", { action: t("broadcastBtn") });
    } catch (e) {
      eventBus.emit("broadcast:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isBroadcasting.set(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await clipboard.copy(text, "copySuccess");
  };

  const loadData = async () => {
    // Restore persisted counters from OS storage
    try {
      const [sc, bc] = await Promise.all([
        storage.get("signCount"),
        storage.get("broadcastCount"),
      ]);
      if (typeof sc === "number") signCount.set(sc);
      if (typeof bc === "number") broadcastCount.set(bc);
    } catch {
      // Counters are non-critical; ignore load failures
    }
  };

  return {
    address: chain.address,
    message,
    signature,
    txHash,
    isSigning,
    isBroadcasting,
    signCount,
    broadcastCount,
    signMessage,
    broadcastMessage,
    copyToClipboard,
    loadData,
  };
}
