/**
 * Neo Convert — Entry Point (React)
 *
 * A client-side Neo N3 key toolkit that generates accounts and converts
 * between key formats (WIF, private key, public key, script hex).
 * Key and script operations run on-device. The optional wallet balance card
 * is a separate read-only RPC surface.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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

    app.actions.register("generate", async () => {
      convert.generateNewAccount();
    }, {
      successKey: "accountGeneratedToast",
      errorKey: "accountGenerationFailed",
    });

    // QR/PDF work stays behind the framework single-flight action wrapper so
    // repeated clicks cannot overlap and failures never become false success.
    app.actions.register("downloadPaperWallet", async () => {
      await convert.downloadPaperWallet();
    }, {
      successKey: "paperWalletReady",
      errorKey: "paperWalletFailed",
    });

    app.actions.register("reset", async () => {
      convert.resetWorkbench();
    }, { successKey: "workbenchCleared" });

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
      if (text) await convert.copyToClipboard(text);
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
        copyStatusType: convert.copyStatusType,
        hasConversionResult: convert.hasConversionResult,
        neoBalance: convert.neoBalance,
        gasBalance: convert.gasBalance,
        formattedNeoBalance: convert.formattedNeoBalance,
        formattedGasBalance: convert.formattedGasBalance,
        balancesLoading: convert.balancesLoading,
        balanceStatus: convert.balanceStatus,
        walletConnected: convert.walletConnected,
      },
      loadData: convert.loadAll,
      cleanup: () => {
        convert.destroy();
      },
    };
  },
});
