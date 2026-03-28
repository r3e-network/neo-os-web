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

import { ref, computed } from "vue";
import type { ChainService, BalanceService, TransferService, EventBus, ClipboardService } from "@shared/services";
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
  /** ChainService instance from PlatformServices */
  chain: ChainService;
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

export function useNeoConvert({ chain, balance, eventBus, clipboard, t }: UseNeoConvertOptions) {
  // ── Tab & UI State ──────────────────────────────────────────────────
  const activeTab = ref("generate");
  const isMobile = ref(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const isLoading = ref(false);

  // ── Account Generator State ─────────────────────────────────────────
  const generatedAccount = ref<NeoAccount | null>(null);
  const accountsGenerated = ref(0);
  const showSecrets = ref(false);

  // ── Converter (delegates to existing useConverter) ──────────────────
  const converter = useConverter(t as (key: string) => string, clipboard);

  // ── Wallet Balances (reactive, auto-refresh on wallet connect) ──────
  const neoBalance = ref(0);
  const gasBalance = ref(0);
  const balancesLoading = ref(false);
  let balanceCleanups: Array<() => void> = [];

  // ── Formatted values for manifest stat/sidebar bindings ─────────────
  const deviceMode = computed(() =>
    isMobile.value ? t("sidebarMobile") : t("sidebarDesktop"),
  );

  const formattedNeoBalance = computed(() => `${neoBalance.value} NEO`);
  const formattedGasBalance = computed(() =>
    `${gasBalance.value.toFixed(gasBalance.value % 1 === 0 ? 0 : 4)} GAS`,
  );
  const formattedAccountsGenerated = computed(() => String(accountsGenerated.value));
  const hasGeneratedAccount = computed(() => generatedAccount.value !== null);
  const hasConversionResult = computed(() =>
    converter.result.value.address !== "" ||
    converter.result.value.publicKey !== "" ||
    converter.result.value.opcodes.length > 0,
  );

  // ── Data Loading ────────────────────────────────────────────────────

  const loadBalances = async () => {
    if (!chain.address.value) return;

    balancesLoading.value = true;
    try {
      const [neo, gas] = await Promise.all([
        balance.getNeoBalance(),
        balance.getGasBalance(),
      ]);
      neoBalance.value = neo;
      gasBalance.value = gas;
    } catch (e) {
      console.warn(`[${APP_ID}] loadBalances failed:`, e instanceof Error ? e.message : String(e));
    } finally {
      balancesLoading.value = false;
    }
  };

  /**
   * Set up reactive balance watchers that auto-refresh on balance changes.
   * Only useful when a wallet is connected (optional for this tool).
   */
  const setupReactiveBalances = () => {
    // Clean up any previous watchers
    cleanupBalances();

    if (!chain.address.value) return;

    const neoWatcher = balance.useBalance("NEO");
    const gasWatcher = balance.useBalance("GAS");

    // Sync reactive refs
    const syncNeo = () => { neoBalance.value = neoWatcher.balance.value; };
    const syncGas = () => { gasBalance.value = gasWatcher.balance.value; };

    // Initial sync
    syncNeo();
    syncGas();

    // Listen for updates via event bus
    const unsubNeo = eventBus.on("BALANCE_CHANGED", syncNeo);
    const unsubGas = eventBus.on("BALANCE_CHANGED", syncGas);

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
    isLoading.value = true;
    try {
      await loadBalances();
      setupReactiveBalances();
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Generate a new Neo N3 account locally.
   * No network calls — pure client-side cryptography.
   */
  const generateNewAccount = () => {
    try {
      generatedAccount.value = generateAccount();
      accountsGenerated.value += 1;
      showSecrets.value = false;
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
    converter.detectAndConvert();

    if (converter.statusType.value === "success") {
      eventBus.emit("convert:converted", {
        format: converter.statusMsg.value,
      });
    } else if (converter.statusType.value === "error") {
      eventBus.emit("convert:error", {
        message: t(converter.statusMsg.value),
      });
    }
  };

  /**
   * Toggle secret field visibility for the generated account.
   */
  const toggleSecrets = () => {
    showSecrets.value = !showSecrets.value;
  };

  /**
   * Copy text to clipboard with a status notification.
   */
  const copyToClipboard = (text: string) => {
    converter.copy(text);
  };

  // ── Cleanup ─────────────────────────────────────────────────────────

  const cleanup = () => {
    cleanupBalances();
  };

  // ── Resize listener for mobile detection ────────────────────────────

  let resizeCleanup: (() => void) | null = null;
  if (typeof window !== "undefined") {
    const handleResize = () => {
      isMobile.value = window.innerWidth < 768;
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
    showSecrets,
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

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    deviceMode,
    formattedNeoBalance,
    formattedGasBalance,
    formattedAccountsGenerated,

    // ── Actions ─────────────────────────────────────────────────────
    generateNewAccount,
    convertInput,
    toggleSecrets,
    copyToClipboard,
    loadAll,
    destroy,
  };
}

/** Return type of useNeoConvert for use in inject/provide typing */
export type UseNeoConvertReturn = ReturnType<typeof useNeoConvert>;
