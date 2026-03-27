import { ref, computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { createSidebarItems } from "@shared/utils";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useStatusMessage } from "@shared/composables/useStatusMessage";

const MAX_MESSAGE_BYTES = 1024;

const getMessageBytes = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length;
};

export function useSignAnything(t: (key: string) => string) {
  const wallet = useWallet() as WalletSDK;
  const { address, signMessage: signWithWallet, chainType } = wallet;
  const { invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-neo-sign-anything",
    t,
    wallet,
  });
  const { status, setStatus } = useStatusMessage(5000);

  // --- Reactive state ---
  const message = ref("");
  const signature = ref("");
  const txHash = ref("");
  const isSigning = ref(false);
  const isBroadcasting = ref(false);
  const currentTab = ref("home");

  // --- Computed ---
  const appState = computed(() => ({
    walletConnected: !!address.value,
    hasSigned: !!signature.value,
  }));

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "sidebarWallet", value: () => (address.value ? t("connected") : t("disconnected")) },
    { labelKey: "signatureResult", value: () => (signature.value ? t("yes") : t("no")) },
    { labelKey: "sidebarBroadcastTx", value: () => (txHash.value ? t("yes") : t("no")) },
    { labelKey: "sidebarMessageLength", value: () => message.value.length },
  ]);

  // --- Actions ---
  const onTabChange = (tabId: string) => {
    currentTab.value = tabId;
  };

  const signMessage = async () => {
    if (!message.value) return;
    if (!requireNeoChain(chainType, t)) return;

    isSigning.value = true;
    signature.value = "";
    txHash.value = ""; // clear previous results

    try {
      await ensureWallet();

      const result = await signWithWallet(message.value);

      // The result might be an object { signature, publicKey, salt } or just signature string
      // depending on the bridge implementation. Let's assume standard response.
      if (typeof result === "string") {
        signature.value = result;
      } else if (result && typeof result === "object") {
        const resultRecord = result as Record<string, unknown>;
        if (resultRecord.signature) {
          signature.value = String(resultRecord.signature);
        } else {
          try { signature.value = JSON.stringify(result); }
          catch (_e: unknown) { console.warn("[useSignAnything] JSON.stringify failed, falling back to String():", _e instanceof Error ? _e.message : String(_e)); signature.value = String(result); }
        }
      } else {
        try { signature.value = JSON.stringify(result); }
        catch (_e: unknown) { console.warn("[useSignAnything] JSON.stringify failed, falling back to String():", _e instanceof Error ? _e.message : String(_e)); signature.value = String(result); }
      }
    } catch (err: unknown) {
      setStatus(formatErrorMessage(err, t("signFailed")), "error");
    } finally {
      isSigning.value = false;
    }
  };

  const broadcastMessage = async () => {
    if (!message.value) return;
    if (!requireNeoChain(chainType, t)) return;
    if (getMessageBytes(message.value) > MAX_MESSAGE_BYTES) {
      setStatus(t("messageTooLong"), "error");
      return;
    }

    isBroadcasting.value = true;
    txHash.value = "";
    signature.value = ""; // clear previous results

    try {
      const walletAddress = await ensureWallet();

      // Broadcast by sending a 0 GAS transfer to self with message in data.
      const { txid } = await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: walletAddress },
          { type: "Hash160", value: walletAddress },
          { type: "Integer", value: "0" },
          { type: "String", value: message.value },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );
      txHash.value = txid || t("txPending");
    } catch (err: unknown) {
      setStatus(formatErrorMessage(err, t("broadcastFailed")), "error");
    } finally {
      isBroadcasting.value = false;
    }
  };

  const copyToClipboard = (text: string) => {
    uni.setClipboardData({
      data: text,
      success: () => {
        setStatus(t("copySuccess"), "success");
      },
    });
  };

  return {
    // State
    address,
    message,
    signature,
    txHash,
    isSigning,
    isBroadcasting,
    status,
    // Computed
    appState,
    sidebarItems,
    // Actions
    onTabChange,
    signMessage,
    broadcastMessage,
    copyToClipboard,
  };
}
