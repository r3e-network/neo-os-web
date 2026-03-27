/**
 * Neo Convert — Entry Point (New Pattern)
 *
 * A client-side Neo N3 key toolkit that generates accounts and converts
 * between key formats (WIF, private key, public key, script hex).
 * All operations run on-device with no server calls.
 *
 * Follows the defineMiniApp() pattern established by daily-checkin/explorer:
 *   1. Import play area, manifest, i18n, domain composable
 *   2. Wire services + composable in the setup function
 *   3. Return state bindings, loadData, cleanup
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoConvert } from "./composables/useNeoConvert";

defineMiniApp({
  appId: "miniapp-neo-convert",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-convert", {
      t: ctx.t as (key: string) => string,
    });

    const convert = useNeoConvert({
      chain: platformServices.chain,
      balance: platformServices.balance,
      transfer: platformServices.transfer,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Register actions for PlayArea and operation panel dispatch
    ctx.registerAction("generate", () => {
      try {
        convert.generateNewAccount();
        ctx.setStatus(ctx.t("btnGenerate"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("invalidFormat"), "error");
      }
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
      // ── State bindings ────────────────────────────────────────────
      // Keys match the valueKey fields in manifest.ts.
      state: {
        // Tab & UI
        activeTab: convert.activeTab,
        deviceMode: convert.deviceMode,
        isMobile: convert.isMobile,
        isLoading: convert.isLoading,

        // Account generator
        generatedAccount: convert.generatedAccount,
        accountsGenerated: convert.formattedAccountsGenerated,
        showSecrets: convert.showSecrets,
        hasGeneratedAccount: convert.hasGeneratedAccount,

        // Converter
        inputKey: convert.inputKey,
        conversionResult: convert.conversionResult,
        conversionStatus: convert.conversionStatus,
        conversionStatusType: convert.conversionStatusType,
        copyStatus: convert.copyStatus,
        hasConversionResult: convert.hasConversionResult,

        // Wallet balances (optional — displayed when wallet connected)
        neoBalance: convert.neoBalance,
        gasBalance: convert.gasBalance,
        formattedNeoBalance: convert.formattedNeoBalance,
        formattedGasBalance: convert.formattedGasBalance,
        balancesLoading: convert.balancesLoading,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      loadData: convert.loadAll,

      // ── Cleanup ───────────────────────────────────────────────────
      cleanup: () => {
        convert.destroy();
        platformServices.destroy();
      },
    };
  },
});
