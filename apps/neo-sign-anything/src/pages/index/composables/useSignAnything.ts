import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
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
  const address = refToObservable(wallet.address);
  const chainType = refToObservable(wallet.chainType);
  const { signMessage: signWithWallet } = wallet;
  const { invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-neo-sign-anything",
    t,
    wallet,
  });
  const sm = useStatusMessage(5000);
  const status = refToObservable(sm.status);
  const { setStatus } = sm;

  // --- Reactive state ---
  const message = createObservable("");
  const signature = createObservable("");
  const txHash = createObservable("");
  const isSigning = createObservable(false);
  const isBroadcasting = createObservable(false);
  const currentTab = createObservable("home");

  // --- Computed ---
  const appState = createDerived(() => ({
    walletConnected: !!address.get(),
    hasSigned: !!signature.get(),
  }), []);

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "sidebarWallet", value: () => (address.get() ? t("connected") : t("disconnected")) },
    { labelKey: "signatureResult", value: () => (signature.get() ? t("yes") : t("no")) },
    { labelKey: "sidebarBroadcastTx", value: () => (txHash.get() ? t("yes") : t("no")) },
    { labelKey: "sidebarMessageLength", value: () => message.get().length },
  ]);

  // --- Actions ---
  const onTabChange = (tabId: string) => {
    currentTab.set(tabId);
  };

  const signMessage = async () => {
    if (!message.get()) return;
    if (!requireNeoChain(chainType, t)) return;

    isSigning.set(true);
    signature.set("");
    txHash.set(""); // clear previous results

    try {
      await ensureWallet();

      const result = await signWithWallet(message.get());

      // The result might be an object { signature, publicKey, salt } or just signature string
      // depending on the bridge implementation. Let's assume standard response.
      if (typeof result === "string") {
        signature.set(result);
      } else if (result && typeof result === "object") {
        const resultRecord = result as Record<string, unknown>;
        if (resultRecord.signature) {
          signature.set(String(resultRecord.signature));
        } else {
          try { signature.set(JSON.stringify(result)); }
          catch (_e) { console.warn("[useSignAnything] JSON.stringify failed, falling back to String():", _e instanceof Error ? _e.message : String(_e)); signature.set(String(result)); }
        }
      } else {
        try { signature.set(JSON.stringify(result)); }
        catch (_e) { console.warn("[useSignAnything] JSON.stringify failed, falling back to String():", _e instanceof Error ? _e.message : String(_e)); signature.set(String(result)); }
      }
    } catch (err: unknown) {
      setStatus(formatErrorMessage(err, t("signFailed")), "error");
    } finally {
      isSigning.set(false);
    }
  };

  const broadcastMessage = async () => {
    if (!message.get()) return;
    if (!requireNeoChain(chainType, t)) return;
    if (getMessageBytes(message.get()) > MAX_MESSAGE_BYTES) {
      setStatus(t("messageTooLong"), "error");
      return;
    }

    isBroadcasting.set(true);
    txHash.set("");
    signature.set(""); // clear previous results

    try {
      const walletAddress = await ensureWallet();

      // Broadcast by sending a 0 GAS transfer to self with message in data.
      const { txid } = await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: walletAddress },
          { type: "Hash160", value: walletAddress },
          { type: "Integer", value: "0" },
          { type: "String", value: message.get() },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );
      txHash.set(txid || t("txPending"));
    } catch (err: unknown) {
      setStatus(formatErrorMessage(err, t("broadcastFailed")), "error");
    } finally {
      isBroadcasting.set(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setStatus(t("copySuccess"), "success");
    }).catch((e: unknown) => {
      console.warn("[neo-sign-anything] clipboard write failed:", e instanceof Error ? e.message : String(e));
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
