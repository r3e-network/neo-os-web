/**
 * useNeoConvert — Domain logic composable for the Neo Convert miniapp
 *
 * This composable encapsulates all key generation, key format conversion,
 * and script disassembly logic. It replaces the stub setup() in main.ts
 * and integrates the existing useConverter composable with PlatformServices.
 *
 * Neo Convert is a CLIENT-SIDE tool — no on-chain transactions needed.
 * It generates Neo N3 accounts locally and converts between key formats
 * (WIF, private key, public key, script hex). All operations run on-device.
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *   - Services are passed in explicitly (no inject)
 *   - Formatted values are provided as computed refs for manifest bindings
 *   - Account generation and conversion are pure client-side operations
 *   - The EventBus is used to emit success/error events for platform toasts
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { BalanceService, TransferService, ClipboardService } from "@shared/services";
import { EventBus } from "@shared/services";
import { generateAccount } from "@/services/neo";
import type { NeoAccount } from "@/services/neo";
import { useConverter } from "./useConverter";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-neo-convert";

// ============================================================================
// Types
// ============================================================================

export interface UseNeoConvertOptions {
  /** MiniApp framework SDK from ctx.framework */
  app: MiniAppFramework;
  /** BalanceService instance from PlatformServices */
  balance: BalanceService;
  /** TransferService instance from PlatformServices */
  transfer: TransferService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** ClipboardService instance from PlatformServices */
  clipboard: ClipboardService;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useNeoConvert({ app, balance, eventBus, clipboard, t }: UseNeoConvertOptions) {
  const chain = app.chain;
  // ── Tab & UI State ──────────────────────────────────────────────────
  const isMobile = createObservable(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const isLoading = createObservable(false);

  // ── Account Generator State ─────────────────────────────────────────
  const generatedAccount = createObservable<NeoAccount | null>(null);
  const accountsGenerated = createObservable(0);
  // Separate reveal flags so unmasking a generated WIF does not also unmask a
  // private key sitting in the converter results (and vice versa).
  const showGeneratedSecrets = createObservable(false);
  const showConversionSecrets = createObservable(false);

  // ── Converter (delegates to existing useConverter) ──────────────────
  const converter = useConverter(t as (key: string) => string, clipboard);

  // ── Wallet Balances (reactive, auto-refresh on wallet connect) ──────
  const neoBalance = createObservable(0);
  const gasBalance = createObservable(0);
  const balancesLoading = createObservable(false);
  let balanceCleanups: Array<() => void> = [];

  // Whether a wallet is connected — drives the hero tiles to show an em-dash
  // (rather than misleading "0 NEO / 0 GAS" zeros that read as real balances)
  // until a wallet is present. Mirrors chain.isConnected reactively.
  const walletConnected = createObservable(Boolean(chain.address.get()));
  const unsubscribeAddress = chain.address.subscribe(() => {
    const connected = Boolean(chain.address.get());
    walletConnected.set(connected);
    if (connected) void loadBalances();
  });

  // ── Formatted values for manifest stat/sidebar bindings ─────────────
  const deviceMode = createDerived(
    () => isMobile.get() ? t("sidebarMobile") : t("sidebarDesktop"),
    [isMobile],
  );

  const formattedNeoBalance = createDerived(
    () => `${neoBalance.get()} NEO`,
    [neoBalance],
  );
  const formattedGasBalance = createDerived(
    () => `${gasBalance.get().toFixed(gasBalance.get() % 1 === 0 ? 0 : 4)} GAS`,
    [gasBalance],
  );
  const formattedAccountsGenerated = createDerived(
    () => String(accountsGenerated.get()),
    [accountsGenerated],
  );
  const hasGeneratedAccount = createDerived(
    () => generatedAccount.get() !== null,
    [generatedAccount],
  );
  const hasConversionResult = createDerived(
    () =>
      converter.result.get().address !== "" ||
      converter.result.get().publicKey !== "" ||
      converter.result.get().scriptHash !== "" ||
      converter.result.get().opcodes.length > 0,
    [converter.result],
  );

  // Sidebar "Active Tab" — derived & localized so it shows a real label
  // (not the raw "generate" key) and reflects the section the user is in:
  // once a conversion result exists, the user is on the Convert tab.
  const activeTab = createDerived(
    () => (hasConversionResult.get() ? t("tabConvert") : t("tabGenerate")),
    [hasConversionResult],
  );

  // ── Data Loading ────────────────────────────────────────────────────

  const loadBalances = async () => {
    if (!chain.address.get()) return;

    balancesLoading.set(true);
    try {
      const [neo, gas] = await Promise.all([
        balance.getNeoBalance(),
        balance.getGasBalance(),
      ]);
      neoBalance.set(neo);
      gasBalance.set(gas);
    } catch (e) {
      console.warn(`[${APP_ID}] loadBalances failed:`, e instanceof Error ? e.message : String(e));
    } finally {
      balancesLoading.set(false);
    }
  };

  /**
   * Set up reactive balance watchers that auto-refresh on balance changes.
   * Only useful when a wallet is connected (optional for this tool).
   */
  const setupReactiveBalances = () => {
    // Clean up any previous watchers
    cleanupBalances();

    if (!chain.address.get()) return;

    const neoWatcher = balance.useBalance("NEO");
    const gasWatcher = balance.useBalance("GAS");

    // Sync reactive refs
    const syncNeo = () => { neoBalance.set(neoWatcher.balance.get()); };
    const syncGas = () => { gasBalance.set(gasWatcher.balance.get()); };

    // Initial sync
    syncNeo();
    syncGas();

    // Listen for updates via event bus
    // Use the canonical event constant ("platform:balance:changed"); the bare
    // "BALANCE_CHANGED" string never matched what BalanceService emits, so these
    // syncs silently never fired on balance changes.
    const unsubNeo = eventBus.on(EventBus.BALANCE_CHANGED, syncNeo);
    const unsubGas = eventBus.on(EventBus.BALANCE_CHANGED, syncGas);

    balanceCleanups = [
      neoWatcher.cleanup,
      gasWatcher.cleanup,
      unsubNeo,
      unsubGas,
    ];
  };

  const cleanupBalances = () => {
    balanceCleanups.forEach((fn) => fn());
    balanceCleanups = [];
  };

  /**
   * Load all data — called by defineMiniApp on mount and wallet reconnect.
   * Since neo-convert is primarily a client-side tool, this mainly loads
   * wallet balances (if connected) for display purposes.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      await loadBalances();
      setupReactiveBalances();
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Generate a new Neo N3 account locally.
   * No network calls — pure client-side cryptography.
   */
  const generateNewAccount = () => {
    try {
      generatedAccount.set(generateAccount());
      accountsGenerated.set(accountsGenerated.get() + 1);
      showGeneratedSecrets.set(false);
      eventBus.emit("convert:generated", { action: t("btnGenerate") });
    } catch (e) {
      eventBus.emit("convert:error", {
        message: e instanceof Error ? e.message : t("invalidFormat"),
      });
      throw e;
    }
  };

  /**
   * Convert an input key/script using auto-detection.
   * Delegates to the existing useConverter composable.
   */
  const convertInput = () => {
    // A new conversion starts masked so a freshly derived private key/WIF is not
    // revealed by a reveal toggle left on from a previous conversion.
    showConversionSecrets.set(false);
    converter.detectAndConvert();

    if (converter.statusType.get() === "success") {
      eventBus.emit("convert:converted", {
        format: converter.statusMsg.get(),
      });
    } else if (converter.statusType.get() === "error") {
      eventBus.emit("convert:error", {
        message: t(converter.statusMsg.get()),
      });
    }
  };

  /**
   * Toggle secret field visibility for the generated account.
   */
  const toggleGeneratedSecrets = () => {
    showGeneratedSecrets.set(!showGeneratedSecrets.get());
  };

  /**
   * Toggle secret field visibility for the converter results.
   */
  const toggleConversionSecrets = () => {
    showConversionSecrets.set(!showConversionSecrets.get());
  };

  /**
   * Copy text to clipboard with a status notification.
   */
  const copyToClipboard = (text: string) => {
    converter.copy(text);
  };

  /**
   * Export a paper wallet PDF with address and WIF QR codes.
   * This is intentionally explicit because the PDF contains private material.
   */
  const downloadPaperWallet = async () => {
    const account = generatedAccount.get();
    if (!account) {
      // Throw so the registerActions wrapper surfaces a localized error
      // toast instead of resolving (which would show a false success).
      throw new Error(t("genEmptyState"));
    }
    const [{ default: QRCode }, { useWalletPdf }] = await Promise.all([
      import("qrcode"),
      import("./useWalletPdf"),
    ]);
    const walletPdf = useWalletPdf(t as (key: string) => string);
    const [addressQr, wifQr] = await Promise.all([
      QRCode.toDataURL(account.address, { margin: 1, width: 320 }),
      QRCode.toDataURL(account.wif, { margin: 1, width: 320 }),
    ]);
    walletPdf.generate(account, addressQr, wifQr);
    eventBus.emit("convert:paper-wallet", { action: t("downloadPdf") });
  };

  // ── Cleanup ─────────────────────────────────────────────────────────

  const cleanup = () => {
    cleanupBalances();
    unsubscribeAddress();
  };

  // ── Resize listener for mobile detection ────────────────────────────

  let resizeCleanup: (() => void) | null = null;
  if (typeof window !== "undefined") {
    const handleResize = () => {
      isMobile.set(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    resizeCleanup = () => window.removeEventListener("resize", handleResize);
  }

  const destroy = () => {
    cleanup();
    resizeCleanup?.();
  };

  return {
    // ── Tab & UI State ──────────────────────────────────────────────
    activeTab,
    isMobile,
    isLoading,

    // ── Account Generator ───────────────────────────────────────────
    generatedAccount,
    accountsGenerated,
    showGeneratedSecrets,
    showConversionSecrets,
    hasGeneratedAccount,

    // ── Converter (pass-through from useConverter) ───────────────────
    inputKey: converter.inputKey,
    conversionResult: converter.result,
    conversionStatus: converter.statusMsg,
    conversionStatusType: converter.statusType,
    copyStatus: converter.copyStatus,
    hasConversionResult,

    // ── Wallet Balances ─────────────────────────────────────────────
    neoBalance,
    gasBalance,
    balancesLoading,
    walletConnected,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    deviceMode,
    formattedNeoBalance,
    formattedGasBalance,
    formattedAccountsGenerated,

    // ── Actions ─────────────────────────────────────────────────────
    generateNewAccount,
    convertInput,
    toggleGeneratedSecrets,
    toggleConversionSecrets,
    copyToClipboard,
    downloadPaperWallet,
    loadAll,
    destroy,
  };
}

/** Return type of useNeoConvert for use in inject/provide typing */
export type UseNeoConvertReturn = ReturnType<typeof useNeoConvert>;
