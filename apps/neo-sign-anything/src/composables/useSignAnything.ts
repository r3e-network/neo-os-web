/**
 * useSignAnything — Domain logic for the Neo Sign Anything miniapp (React)
 *
 * Everything is routed through the MiniApp framework SDK (ctx.framework):
 * wallet address/connect, the broadcast invoke and transfer arg builders
 * (app.chain), message signing via app.chain.signMessage (which normalizes
 * the wallet-specific string vs `{ signature | data, publicKey }` result
 * shapes into one typed envelope), clipboard via app.clipboard, and session
 * sign/broadcast counters via app.storage.remote (OS storage passthrough —
 * keys unchanged). The broadcast targets the native GAS contract (external).
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const MAX_MESSAGE_BYTES = 1024;

const getMessageBytes = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length;
};

export interface UseSignAnythingOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSignAnything({ app, t }: UseSignAnythingOptions) {
  const message = createObservable("");
  const signature = createObservable("");
  // The signer's public key, captured alongside the signature so the produced
  // artifact carries everything a third party needs (address ⇄ public key ⇄
  // signature) rather than just the bare signature hex.
  const publicKey = createObservable("");
  const txHash = createObservable("");
  // Pending state surfaced separately from txHash so the copyable hash field
  // never holds prose ("Transaction sent (ID pending)") that looks like a hash.
  const txPending = createObservable(false);
  // The message text the current artifacts belong to. Signing and broadcasting
  // keep their own results visible side-by-side as long as they describe the
  // same message; changing the message is what clears both.
  const resultMessage = createObservable("");
  const isSigning = createObservable(false);
  const isBroadcasting = createObservable(false);
  const signCount = createObservable(0);
  const broadcastCount = createObservable(0);

  /**
   * Clear both artifacts when the message they describe changes, so a stale
   * signature/txHash can never be shown against a different message.
   */
  const syncResultMessage = (msg: string) => {
    if (resultMessage.get() !== msg) {
      signature.set("");
      publicKey.set("");
      txHash.set("");
      txPending.set(false);
      resultMessage.set(msg);
    }
  };

  const signMessage = async (msg: string) => {
    if (!msg) return;
    isSigning.set(true);
    // Only clear the artifact being regenerated (the signature) — keep any
    // broadcast txHash for the SAME message so sign-then-anchor coexists.
    syncResultMessage(msg);
    signature.set("");
    publicKey.set("");
    try {
      // app.chain.signMessage normalizes the wallet-specific result shapes
      // (bare signature string vs { signature | data, publicKey } records)
      // into one typed { signature, publicKey?, data? } envelope.
      const result = await app.chain.signMessage(msg);
      signature.set(result.signature);
      // Capture the public key when the wallet returns it, so the signature
      // can actually be verified later (address alone is not enough).
      if (result.publicKey) publicKey.set(result.publicKey);

      signCount.set(signCount.get() + 1);
      app.storage.remote.set("signCount", signCount.get()).catch(() => {});
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
    // Only clear the artifact being regenerated (the txHash) — keep any
    // signature for the SAME message so the signed proof stays visible.
    syncResultMessage(msg);
    txHash.set("");
    txPending.set(false);
    try {
      await app.chain.ensureWallet();
      const walletAddress = app.chain.address.get() as string;

      const result = await app.chain.invoke(
        "transfer",
        [
          app.chain.arg.hash160(walletAddress),
          app.chain.arg.hash160(walletAddress),
          app.chain.arg.integer(0),
          app.chain.arg.string(msg),
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Keep txHash empty (not prose) when the wallet returns no id; surface
      // the pending state via a separate flag so the copy button stays disabled.
      if (result.txid) {
        txHash.set(result.txid);
        txPending.set(false);
      } else {
        txHash.set("");
        txPending.set(true);
      }
      broadcastCount.set(broadcastCount.get() + 1);
      app.storage.remote.set("broadcastCount", broadcastCount.get()).catch(() => {});
    } finally {
      isBroadcasting.set(false);
    }
  };

  /**
   * Hash a file locally (SHA-256, in-browser) and sign the digest. This keeps
   * the signed payload tiny (well under the 1024-byte broadcast cap) and never
   * uploads the file. Fulfills the zh manifest's "sign any message OR FILE"
   * promise without changing the existing message-signing path.
   */
  const hashFile = async (file: File): Promise<string> => {
    // Prefer File.arrayBuffer() (standard in all browsers); fall back to Response
    // for environments/polyfills where the Blob method is unavailable.
    const buffer =
      typeof file.arrayBuffer === "function"
        ? await file.arrayBuffer()
        : await new Response(file).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  /**
   * Compute a file's SHA-256 digest and load it into the message field as a
   * "sha256:<digest>" line, ready to sign or broadcast. Returns the digest.
   */
  const loadFileDigest = async (file: File): Promise<string> => {
    if (!file) return "";
    const digest = await hashFile(file);
    const payload = `sha256:${digest}`;
    message.set(payload);
    return payload;
  };

  const copyToClipboard = async (text: string) => {
    await app.clipboard.copy(text, { successKey: "copySuccess" });
  };

  const loadData = async () => {
    // Restore persisted counters from OS storage
    try {
      const [sc, bc] = await Promise.all([
        app.storage.remote.get("signCount"),
        app.storage.remote.get("broadcastCount"),
      ]);
      if (typeof sc === "number") signCount.set(sc);
      if (typeof bc === "number") broadcastCount.set(bc);
    } catch {
      // Counters are non-critical; ignore load failures
    }
  };

  return {
    address: app.chain.address,
    message,
    signature,
    publicKey,
    txHash,
    txPending,
    resultMessage,
    isSigning,
    isBroadcasting,
    signCount,
    broadcastCount,
    signMessage,
    broadcastMessage,
    loadFileDigest,
    copyToClipboard,
    loadData,
  };
}
