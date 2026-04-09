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

    ctx.registerAction("convert", () => {
      convert.convertInput();
      if (convert.conversionStatusType.value === "success") {
        ctx.setStatus(ctx.t(convert.conversionStatus.value), "success");
      } else if (convert.conversionStatusType.value === "error") {
        ctx.setStatus(ctx.t(convert.conversionStatus.value), "error");
      }
    });

    ctx.registerAction("toggleSecrets", () => {
      convert.toggleSecrets();
    });

    ctx.registerAction("copy", (text?: string) => {
      if (typeof text === "string") {
        convert.copyToClipboard(text);
      }
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
