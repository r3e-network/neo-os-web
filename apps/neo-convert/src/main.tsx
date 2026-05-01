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
    const platformServices = ctx.services;

    const convert = useNeoConvert({
      chain: platformServices.chain,
      balance: platformServices.balance,
      transfer: platformServices.transfer,
      eventBus: platformServices.events,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    registerActions(ctx, {
      generate: {
        handler: async () => convert.generateNewAccount(),
        successKey: "btnGenerate",
        errorKey: "invalidFormat",
      },
    });

    ctx.registerAction("convert", async (...args: unknown[]) => {
      const incoming = typeof args[0] === "string" ? args[0] : "";
      if (incoming) convert.inputKey.set(incoming);
      convert.convertInput();
      if (convert.conversionStatusType.get() === "success") {
        ctx.setStatus(ctx.t(convert.conversionStatus.get()), "success");
      } else if (convert.conversionStatusType.get() === "error") {
        ctx.setStatus(ctx.t(convert.conversionStatus.get()), "error");
      }
    });

    ctx.registerAction("toggleSecrets", async () => {
      convert.toggleSecrets();
    });

    ctx.registerAction("copy", async (...args: unknown[]) => {
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
        showSecrets: convert.showSecrets,
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
      },
      loadData: convert.loadAll,
      cleanup: () => {
        convert.destroy();
      },
    };
  },
});
