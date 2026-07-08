/**
 * Neo Convert — Entry Point (React)
 *
 * A client-side Neo N3 key toolkit that generates accounts and converts
 * between key formats (WIF, private key, public key, script hex).
 * All operations run on-device with no server calls.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoConvert } from "./composables/useNeoConvert";

defineMiniApp({
  appId: "miniapp-neo-convert",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    const convert = useNeoConvert({
      app,
      t: ctx.t,
    });

    registerActions(ctx, {
      generate: {
        handler: async () => convert.generateNewAccount(),
        successKey: "btnGenerate",
        errorKey: "invalidFormat",
      },
      // Route the paper-wallet export through registerActions so its
      // genuinely failure-prone steps (dynamic qrcode/pdf imports,
      // QRCode.toDataURL) surface a localized error toast instead of
      // rejecting silently. The host dispatch does not wrap handlers.
      downloadPaperWallet: {
        handler: async () => convert.downloadPaperWallet(),
        successKey: "paperWalletReady",
        errorKey: "paperWalletFailed",
      },
    });

    ctx.framework.actions.register("convert", async (...args: unknown[]) => {
      const incoming = typeof args[0] === "string" ? args[0] : "";
      if (incoming) convert.inputKey.set(incoming);
      convert.convertInput();
      if (convert.conversionStatusType.get() === "success") {
        app.notify.success(convert.conversionStatus.get());
      } else if (convert.conversionStatusType.get() === "error") {
        // The status observable already carries the localized copy (or a key
        // t() falls through verbatim) — pass it as the fallback key so the
        // toast text matches the old setStatus branch byte-for-byte.
        app.notify.error(undefined, convert.conversionStatus.get());
      }
    });

    ctx.framework.actions.register("toggleGeneratedSecrets", async () => {
      convert.toggleGeneratedSecrets();
    });

    ctx.framework.actions.register("toggleConversionSecrets", async () => {
      convert.toggleConversionSecrets();
    });

    ctx.framework.actions.register("copy", async (...args: unknown[]) => {
      const text = typeof args[0] === "string" ? args[0] : "";
      if (text) convert.copyToClipboard(text);
    });

    return {
      state: {
        activeTab: convert.activeTab,
        deviceMode: convert.deviceMode,
        isMobile: convert.isMobile,
        isLoading: convert.isLoading,
        generatedAccount: convert.generatedAccount,
        accountsGenerated: convert.formattedAccountsGenerated,
        showGeneratedSecrets: convert.showGeneratedSecrets,
        showConversionSecrets: convert.showConversionSecrets,
        hasGeneratedAccount: convert.hasGeneratedAccount,
        inputKey: convert.inputKey,
        conversionResult: convert.conversionResult,
        conversionStatus: convert.conversionStatus,
        conversionStatusType: convert.conversionStatusType,
        copyStatus: convert.copyStatus,
        hasConversionResult: convert.hasConversionResult,
        neoBalance: convert.neoBalance,
        gasBalance: convert.gasBalance,
        formattedNeoBalance: convert.formattedNeoBalance,
        formattedGasBalance: convert.formattedGasBalance,
        balancesLoading: convert.balancesLoading,
        walletConnected: convert.walletConnected,
      },
      loadData: convert.loadAll,
      cleanup: () => {
        convert.destroy();
      },
    };
  },
});
