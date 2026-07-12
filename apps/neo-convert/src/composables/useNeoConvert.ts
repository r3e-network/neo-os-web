/**
 * useNeoConvert — Domain logic composable for the Neo Convert miniapp
 *
 * This composable encapsulates all key generation, key format conversion,
 * and script disassembly logic. It replaces the stub setup() in main.ts
 * and integrates the existing useConverter composable with PlatformServices.
 *
 * Neo Convert is a CLIENT-SIDE tool — no on-chain transactions needed.
 * It generates Neo N3 accounts locally and converts between key formats
 * (WIF, private key, public key, script hex). Those conversion operations run
 * on-device; the optional connected-wallet snapshot is read-only RPC.
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *   - Everything rides the framework SDK (app.wallet identity + balances,
 *     app.clipboard copy) — no raw platform services
 *   - Formatted values are provided as computed refs for manifest bindings
 *   - Account generation and conversion are pure client-side operations
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { generateAccount } from "../services/neo";
import type { NeoAccount } from "../services/neo";
import { useConverter } from "./useConverter";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-neo-convert";

function formatUnits(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const magnitude = negative ? -raw : raw;
  if (decimals === 0) return `${negative ? "-" : ""}${magnitude.toString()}`;
  const base = 10n ** BigInt(decimals);
  const whole = magnitude / base;
  const fraction = (magnitude % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

// ============================================================================
// Types
// ============================================================================

export interface UseNeoConvertOptions {
  /** MiniApp framework SDK from ctx.framework */
  app: MiniAppFramework;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useNeoConvert({ app, t }: UseNeoConvertOptions) {
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
  const converter = useConverter(t as (key: string) => string, app.clipboard);
  const unsubscribeConverterInput = converter.inputKey.subscribe(() => {
    showConversionSecrets.set(false);
  });

  // ── Wallet Balances (reactive, auto-refresh on wallet connect) ──────
  const neoBalance = createObservable("");
  const gasBalance = createObservable("");
  const balancesLoading = createObservable(false);
  const balanceStatus = createObservable<"idle" | "loading" | "ready" | "error">("idle");
  let balanceCleanups: Array<() => void> = [];
  let balanceLoadGeneration = 0;

  // Whether a wallet is connected — drives the hero tiles to show an em-dash
  // (rather than misleading "0 NEO / 0 GAS" zeros that read as real balances)
  // until a wallet is present. Mirrors app.wallet.isConnected reactively via
  // the framework identity-diff hook (RFC P0-5), which only fires when the
  // connected address actually changes.
  const walletConnected = createObservable(app.wallet.isConnected());
  const unsubscribeAddress = app.wallet.onAccountChanged(({ current }) => {
    const connected = current !== null;
    walletConnected.set(connected);
    // Invalidate and clear the previous identity's snapshot immediately. A
    // newly connected wallet must never spend a loading interval beside the
    // balances that belonged to the address it replaced.
    balanceLoadGeneration += 1;
    cleanupBalances();
    neoBalance.set("");
    gasBalance.set("");
    balancesLoading.set(false);
    balanceStatus.set("idle");
    if (connected) {
      setupReactiveBalances();
      void loadBalances();
    }
  });

  // ── Formatted values for manifest stat/sidebar bindings ─────────────
  const deviceMode = createDerived(
    () => isMobile.get() ? t("sidebarMobile") : t("sidebarDesktop"),
    [isMobile],
  );

  const formattedNeoBalance = createDerived(
    () => neoBalance.get() ? `${neoBalance.get()} NEO` : "—",
    [neoBalance],
  );
  const formattedGasBalance = createDerived(
    () => gasBalance.get() ? `${gasBalance.get()} GAS` : "—",
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
    () => (converter.inputKey.get().trim() || hasConversionResult.get() ? t("tabConvert") : t("tabGenerate")),
    [converter.inputKey, hasConversionResult],
  );

  // ── Data Loading ────────────────────────────────────────────────────

  const loadBalances = async () => {
    const address = app.wallet.address();
    const generation = ++balanceLoadGeneration;
    if (!address) {
      neoBalance.set("");
      gasBalance.set("");
      balancesLoading.set(false);
      balanceStatus.set("idle");
      return;
    }

    balancesLoading.set(true);
    balanceStatus.set("loading");
    try {
      const [neo, gas] = await Promise.all([
        app.wallet.raw("NEO", address),
        app.wallet.raw("GAS", address),
      ]);
      if (neo < 0n || gas < 0n) throw new Error("negative wallet balance");
      if (generation !== balanceLoadGeneration) return;
      if (app.wallet.address() !== address) {
        balanceStatus.set("idle");
        return;
      }
      neoBalance.set(formatUnits(neo, 0));
      gasBalance.set(formatUnits(gas, 8));
      balanceStatus.set("ready");
    } catch (e) {
      if (generation === balanceLoadGeneration) {
        neoBalance.set("");
        gasBalance.set("");
        balanceStatus.set("error");
        console.warn(`[${APP_ID}] loadBalances failed:`, e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (generation === balanceLoadGeneration) balancesLoading.set(false);
    }
  };

  /**
   * Set up reactive balance watchers that auto-refresh on balance changes.
   * Only useful when a wallet is connected (optional for this tool).
   * app.wallet.observeBalance is BALANCE_CHANGED-wired internally, so the
   * hand-rolled event-bus sync subscriptions are gone.
   */
  const setupReactiveBalances = () => {
    // Clean up any previous watchers
    cleanupBalances();

    if (!app.wallet.isConnected()) return;

    const neoWatcher = app.wallet.observeBalance("NEO");
    const gasWatcher = app.wallet.observeBalance("GAS");

    // Watcher values can be number-backed in service hosts. Treat them only as
    // invalidation signals and re-read raw base units for exact display.
    const refreshExactBalances = () => { void loadBalances(); };
    const unsubNeo = neoWatcher.balance.subscribe(refreshExactBalances);
    const unsubGas = gasWatcher.balance.subscribe(refreshExactBalances);

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
      setupReactiveBalances();
      await loadBalances();
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
    // Failures propagate to the host action wrapper (errorKey toast); the
    // earlier "convert:generated"/"convert:error" emits had no subscriber.
    converter.reset();
    generatedAccount.set(generateAccount());
    accountsGenerated.set(accountsGenerated.get() + 1);
    showGeneratedSecrets.set(false);
  };

  /**
   * Convert an input key/script using auto-detection.
   * Delegates to the existing useConverter composable.
   */
  const convertInput = () => {
    // A new conversion starts masked so a freshly derived private key/WIF is not
    // revealed by a reveal toggle left on from a previous conversion.
    // (Success/error toasts come from the host's convert action, which reads
    // the status observables; the earlier "convert:*" emits had no subscriber.)
    showConversionSecrets.set(false);
    converter.detectAndConvert();
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
  const copyToClipboard = async (text: string): Promise<boolean> => {
    return converter.copy(text);
  };

  const resetWorkbench = () => {
    converter.reset();
    generatedAccount.set(null);
    showGeneratedSecrets.set(false);
    showConversionSecrets.set(false);
  };

  /**
   * Export a paper wallet PDF with address and WIF QR codes.
   * This is intentionally explicit because the PDF contains private material.
   */
  const downloadPaperWallet = async () => {
    const account = generatedAccount.get();
    if (!account) {
      // Throw so the framework action wrapper surfaces a localized error
      // toast instead of resolving (which would show a false success).
      throw new Error(t("genEmptyState"));
    }
    if (!showGeneratedSecrets.get()) {
      throw new Error(t("paperWalletRequiresReveal"));
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
  };

  // ── Cleanup ─────────────────────────────────────────────────────────

  const cleanup = () => {
    balanceLoadGeneration += 1;
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
    resetWorkbench();
    unsubscribeConverterInput();
    converter.dispose();
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
    copyStatusType: converter.copyStatusType,
    hasConversionResult,

    // ── Wallet Balances ─────────────────────────────────────────────
    neoBalance,
    gasBalance,
    balancesLoading,
    balanceStatus,
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
    resetWorkbench,
    downloadPaperWallet,
    loadAll,
    destroy,
  };
}

/** Return type of useNeoConvert for use in inject/provide typing */
export type UseNeoConvertReturn = ReturnType<typeof useNeoConvert>;
