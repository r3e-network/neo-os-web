export type LastSurvivorPrimaryAction = "connect" | "buy" | "none";

export type LastSurvivorGateReason =
  | "ready"
  | "connect-wallet"
  | "connecting"
  | "buying"
  | "confirming"
  | "settling"
  | "loading"
  | "service-unavailable"
  | "financial-state-unavailable"
  | "recovery-storage-unavailable"
  | "settle-required"
  | "round-waiting"
  | "paid-disabled"
  | "await-rival"
  | "invalid-selection"
  | "insufficient-gas";

export interface LastSurvivorGateInput {
  appMode: string;
  walletConnected: boolean;
  selectedCount: number;
  estimatedCostGas: number;
  prepaidCredit: number;
  walletGasBalance: number;
  roundDataAvailable: boolean;
  writeDataAvailable: boolean;
  storageHealthy: boolean;
  isRoundActive: boolean;
  needsLifecycleSync: boolean;
  newPaidRoundsEnabled: boolean;
  hasHistoricalPosition: boolean;
  isBuyingKeys: boolean;
  purchasePending: boolean;
  isSettling: boolean;
  isLoading: boolean;
  isConnectingWallet: boolean;
  hasValidationError: boolean;
  /** Guest-only turn gate: false while the player already holds the final seat. */
  guestMoveReady?: boolean;
}

export interface LastSurvivorTransactionGate {
  primaryAction: LastSurvivorPrimaryAction;
  primaryEnabled: boolean;
  settleEnabled: boolean;
  presetsEnabled: boolean;
  reason: LastSurvivorGateReason;
  availableGas: number;
  shortfallGas: number;
}

const GAS_ROUNDING_TOLERANCE = 0.5e-8;
const MAX_KEYS_PER_BUY = 1000;

function safeGas(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Pure pre-flight state for the Phaser controls.
 *
 * This does not move funds or duplicate the composable's authoritative
 * shortfall deposit. It only prevents impossible wallet prompts and chooses
 * the one action the primary arena button is allowed to dispatch.
 */
export function getLastSurvivorTransactionGate(
  input: LastSurvivorGateInput,
): LastSurvivorTransactionGate {
  const isGuest = input.appMode === "guest";
  const availableGas = safeGas(input.prepaidCredit) + safeGas(input.walletGasBalance);
  const estimatedCostGas = safeGas(input.estimatedCostGas);
  const shortfallGas = Math.max(0, estimatedCostGas - availableGas);
  const presetsEnabled =
    (isGuest || input.newPaidRoundsEnabled) &&
    (!isGuest || input.guestMoveReady !== false) &&
    !input.isBuyingKeys &&
    !input.purchasePending &&
    !input.isSettling &&
    !input.isLoading &&
    !input.isConnectingWallet &&
    input.storageHealthy &&
    (isGuest || input.writeDataAvailable);

  const result = (
    reason: LastSurvivorGateReason,
    primaryAction: LastSurvivorPrimaryAction = "none",
    primaryEnabled = false,
  ): LastSurvivorTransactionGate => ({
    primaryAction,
    primaryEnabled,
    settleEnabled:
      reason === "settle-required" &&
      input.roundDataAvailable &&
      input.storageHealthy &&
      !input.isBuyingKeys &&
      !input.purchasePending &&
      !input.isSettling &&
      !input.isLoading &&
      (isGuest || input.walletConnected),
    presetsEnabled,
    reason,
    availableGas,
    shortfallGas,
  });

  if (input.isBuyingKeys) return result("buying");
  if (input.purchasePending) return result("confirming");
  if (input.isSettling) return result("settling");
  if (input.isLoading) return result("loading");
  if (input.isConnectingWallet) return result("connecting");

  // Connecting is deliberately its own action. The next press, after the
  // wallet + round + balance refresh completes, may recover or settle. A
  // disconnected app cannot know whether this wallet has contract credit, so
  // paid-disabled builds still allow this terminal, non-purchasing connect.
  if (!isGuest && !input.walletConnected) {
    return result("connect-wallet", "connect", true);
  }

  // A hidden launcher is not an authorization boundary. Once connected, block
  // a stale/deep-linked GameFi surface unless a known position needs recovery.
  if (!isGuest && !input.newPaidRoundsEnabled && !input.hasHistoricalPosition) {
    return result("paid-disabled");
  }

  if (!input.roundDataAvailable) return result("service-unavailable");
  if (!input.storageHealthy) return result("recovery-storage-unavailable");
  if (input.needsLifecycleSync) return result("settle-required");
  if (!input.isRoundActive) return result("round-waiting");
  if (!isGuest && !input.newPaidRoundsEnabled) return result("paid-disabled");
  if (isGuest && input.guestMoveReady === false) return result("await-rival");
  if (!isGuest && !input.writeDataAvailable) return result("financial-state-unavailable");

  if (
    input.hasValidationError ||
    !Number.isInteger(input.selectedCount) ||
    input.selectedCount <= 0 ||
    input.selectedCount > MAX_KEYS_PER_BUY ||
    (!isGuest && estimatedCostGas <= 0)
  ) {
    return result("invalid-selection");
  }

  // GAS has 8 decimals. Ignore only a sub-half-base-unit float conversion
  // delta; a real one-base-unit shortfall is still blocked before prompting.
  if (!isGuest && availableGas + GAS_ROUNDING_TOLERANCE < estimatedCostGas) {
    return result("insufficient-gas");
  }

  return result("ready", "buy", true);
}
