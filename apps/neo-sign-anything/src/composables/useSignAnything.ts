/**
 * useSignAnything — Domain logic for the Neo Sign Anything miniapp
 *
 * Receives ChainService + EventBus + ClipboardService from PlatformServices
 * and StorageProxy from OS services. Chain calls target the native GAS
 * contract (external) for broadcast, so they stay on ChainService.
 * Session sign/broadcast counters are persisted via OS storage.
 */

import { ref } from "vue";
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
  const message = ref("");
  const signature = ref("");
  const txHash = ref("");
  const isSigning = ref(false);
  const isBroadcasting = ref(false);
  const signCount = ref(0);
  const broadcastCount = ref(0);

  const signMessage = async (msg: string) => {
    if (!msg) return;
    isSigning.value = true;
    signature.value = "";
    txHash.value = "";
    try {
      const result = await chain.signMessage(msg);

      // Parse the result — may be an object { signature, publicKey, data } or string
      if (typeof result === "string") {
        signature.value = result;
      } else if (result && typeof result === "object") {
        const resultRecord = result as Record<string, unknown>;
        if (resultRecord.signature) {
          signature.value = String(resultRecord.signature);
        } else if (resultRecord.data) {
          signature.value = String(resultRecord.data);
        } else {
          try { signature.value = JSON.stringify(result); }
          catch { signature.value = String(result); }
        }
      } else {
        try { signature.value = JSON.stringify(result); }
        catch { signature.value = String(result); }
      }

      signCount.value += 1;
      storage.set("signCount", signCount.value).catch(() => {});
      eventBus.emit("sign:success", { action: t("signBtn") });
    } catch (e) {
      eventBus.emit("sign:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isSigning.value = false;
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
    isBroadcasting.value = true;
    txHash.value = "";
    signature.value = "";
    try {
      await chain.ensureWallet();
      const walletAddress = chain.address.value as string;

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

      txHash.value = result.txid || t("txPending");
      broadcastCount.value += 1;
      storage.set("broadcastCount", broadcastCount.value).catch(() => {});
      eventBus.emit("broadcast:success", { action: t("broadcastBtn") });
    } catch (e) {
      eventBus.emit("broadcast:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isBroadcasting.value = false;
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
      if (typeof sc === "number") signCount.value = sc;
      if (typeof bc === "number") broadcastCount.value = bc;
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
