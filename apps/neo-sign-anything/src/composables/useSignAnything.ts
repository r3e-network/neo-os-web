/**
 * useSignAnything — Domain logic for the Neo Sign Anything miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatErrorMessage } from "@shared/utils/errorHandling";

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
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSignAnything({ chain, eventBus, t }: UseSignAnythingOptions) {
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
    try {
      await chain.ensureWallet();
      const result = await chain.signMessage(msg);
      signature.value = result;
      signCount.value += 1;
      eventBus.emit("sign:success", { action: t("signBtn") });
    } catch (e: unknown) {
      eventBus.emit("sign:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isSigning.value = false;
    }
  };

  const broadcastMessage = async (msg: string) => {
    if (!msg) return;
    if (getMessageBytes(msg) > MAX_MESSAGE_BYTES) {
      throw new Error(t("messageTooLong"));
    }
    isBroadcasting.value = true;
    try {
      await chain.ensureWallet();
      const result = await chain.invoke("broadcastMessage", [
        { type: "String", value: msg },
      ]);
      txHash.value = result.txid || "";
      broadcastCount.value += 1;
      eventBus.emit("broadcast:success", { action: t("broadcastBtn") });
    } catch (e: unknown) {
      eventBus.emit("broadcast:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isBroadcasting.value = false;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      eventBus.emit("copy:success", { action: t("copySuccess") });
    } catch (e: unknown) {
      console.warn("[useSignAnything] clipboard copy failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadData = async () => {
    // No persistent data to load for sign-anything
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
