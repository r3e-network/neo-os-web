import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSignAnything } from "./composables/useSignAnything";

defineMiniApp({
  appId: "miniapp-neo-sign-anything",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const signAnything = useSignAnything({
      app: ctx.framework,
      t: ctx.t,
    });

    ctx.framework.actions.register("connectWallet", () => signAnything.connectWallet());
    ctx.framework.actions.register("signMessage", () => signAnything.signMessage());
    ctx.framework.actions.register("setMessage", (...args: unknown[]) => {
      signAnything.setMessage(String(args[0] ?? ""));
    });
    ctx.framework.actions.register("setSigningMode", (...args: unknown[]) => {
      signAnything.setSigningMode(String(args[0] ?? ""));
    });
    ctx.framework.actions.register("setSigningDomain", (...args: unknown[]) => {
      signAnything.setSigningDomain(String(args[0] ?? ""));
    });
    ctx.framework.actions.register(
      "loadFileDigest",
      (...args: unknown[]) => {
        const file = args[0];
        if (!(file instanceof File)) throw new Error(ctx.t("fileRequired"));
        return signAnything.loadFileDigest(file);
      },
      { successKey: "fileHashed" },
    );
    ctx.framework.actions.register("copyToClipboard", (...args: unknown[]) =>
      signAnything.copyToClipboard(String(args[0] ?? "")),
    );
    ctx.framework.actions.register("clearHistory", () => {
      signAnything.clearHistory();
    });

    return {
      state: {
        address: signAnything.address,
        network: signAnything.network,
        message: signAnything.message,
        signingMode: signAnything.signingMode,
        signingDomain: signAnything.signingDomain,
        fileInfo: signAnything.fileInfo,
        payloadText: signAnything.payloadText,
        payloadHash: signAnything.payloadHash,
        payloadBytes: signAnything.payloadBytes,
        payloadStatus: signAnything.payloadStatus,
        payloadError: signAnything.payloadError,
        signature: signAnything.signature,
        signatureEncoding: signAnything.signatureEncoding,
        publicKey: signAnything.publicKey,
        artifact: signAnything.artifact,
        proofBundle: signAnything.proofBundle,
        isConnecting: signAnything.isConnecting,
        isHashing: signAnything.isHashing,
        isSigning: signAnything.isSigning,
        operationStatus: signAnything.operationStatus,
        lastError: signAnything.lastError,
        signCount: signAnything.signCount,
        history: signAnything.history,
        historyStorageHealthy: signAnything.historyStorageHealthy,
      },
      loadData: signAnything.loadData,
      cleanup: signAnything.cleanup,
    };
  },
});
