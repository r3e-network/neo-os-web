import { describe, expect, it } from "vitest";
import {
  getLastSurvivorTransactionGate,
  type LastSurvivorGateInput,
} from "./transaction-gate";

function input(overrides: Partial<LastSurvivorGateInput> = {}): LastSurvivorGateInput {
  return {
    appMode: "gamefi",
    walletConnected: true,
    selectedCount: 3,
    estimatedCostGas: 0.3,
    prepaidCredit: 0.1,
    walletGasBalance: 0.2,
    roundDataAvailable: true,
    writeDataAvailable: true,
    storageHealthy: true,
    isRoundActive: true,
    needsLifecycleSync: false,
    newPaidRoundsEnabled: true,
    hasHistoricalPosition: false,
    isBuyingKeys: false,
    purchasePending: false,
    isSettling: false,
    isLoading: false,
    isConnectingWallet: false,
    hasValidationError: false,
    ...overrides,
  };
}

describe("Last Survivor transaction gate", () => {
  it("keeps guest play local and independent of wallet funds", () => {
    const gate = getLastSurvivorTransactionGate(input({
      appMode: "guest",
      walletConnected: false,
      prepaidCredit: 0,
      walletGasBalance: 0,
      estimatedCostGas: 999,
    }));

    expect(gate.primaryAction).toBe("buy");
    expect(gate.primaryEnabled).toBe(true);
    expect(gate.reason).toBe("ready");
  });

  it("locks guest score spam while the player already holds the final seat", () => {
    const gate = getLastSurvivorTransactionGate(input({
      appMode: "guest",
      walletConnected: false,
      guestMoveReady: false,
    }));

    expect(gate.reason).toBe("await-rival");
    expect(gate.primaryEnabled).toBe(false);
    expect(gate.presetsEnabled).toBe(false);
  });

  it("turns a disconnected GameFi primary action into connect only", () => {
    const gate = getLastSurvivorTransactionGate(input({
      walletConnected: false,
      roundDataAvailable: false,
      needsLifecycleSync: true,
    }));

    expect(gate.primaryAction).toBe("connect");
    expect(gate.primaryEnabled).toBe(true);
    expect(gate.settleEnabled).toBe(false);
    expect(gate.reason).toBe("connect-wallet");
  });

  it("fails closed for new paid rounds while preserving explicit recovery", () => {
    const recoveryDiscovery = getLastSurvivorTransactionGate(input({
      walletConnected: false,
      newPaidRoundsEnabled: false,
    }));
    expect(recoveryDiscovery.reason).toBe("connect-wallet");
    expect(recoveryDiscovery.primaryAction).toBe("connect");
    expect(recoveryDiscovery.primaryEnabled).toBe(true);
    expect(recoveryDiscovery.presetsEnabled).toBe(false);

    const recoveryConnect = getLastSurvivorTransactionGate(input({
      walletConnected: false,
      newPaidRoundsEnabled: false,
      hasHistoricalPosition: true,
      prepaidCredit: 0.4,
    }));
    expect(recoveryConnect.reason).toBe("connect-wallet");
    expect(recoveryConnect.primaryAction).toBe("connect");

    const recoverySettle = getLastSurvivorTransactionGate(input({
      newPaidRoundsEnabled: false,
      hasHistoricalPosition: true,
      needsLifecycleSync: true,
      isRoundActive: false,
    }));
    expect(recoverySettle.reason).toBe("settle-required");
    expect(recoverySettle.settleEnabled).toBe(true);

    const noFreshBuyFromRecovery = getLastSurvivorTransactionGate(input({
      newPaidRoundsEnabled: false,
      hasHistoricalPosition: true,
      prepaidCredit: 0.4,
    }));
    expect(noFreshBuyFromRecovery.reason).toBe("paid-disabled");
    expect(noFreshBuyFromRecovery.primaryAction).toBe("none");
  });

  it("combines prepaid credit and wallet GAS before enabling a buy", () => {
    const gate = getLastSurvivorTransactionGate(input({
      estimatedCostGas: 0.75,
      prepaidCredit: 0.5,
      walletGasBalance: 0.25,
    }));

    expect(gate.availableGas).toBeCloseTo(0.75, 8);
    expect(gate.shortfallGas).toBe(0);
    expect(gate.primaryAction).toBe("buy");
    expect(gate.primaryEnabled).toBe(true);

    const creditOnly = getLastSurvivorTransactionGate(input({
      estimatedCostGas: 0.4,
      prepaidCredit: 0.4,
      walletGasBalance: 0,
    }));
    expect(creditOnly.primaryAction).toBe("buy");
  });

  it("blocks a real funding shortfall before opening the wallet", () => {
    const gate = getLastSurvivorTransactionGate(input({
      estimatedCostGas: 0.3,
      prepaidCredit: 0.05,
      walletGasBalance: 0.1,
    }));

    expect(gate.reason).toBe("insufficient-gas");
    expect(gate.primaryAction).toBe("none");
    expect(gate.primaryEnabled).toBe(false);
    expect(gate.shortfallGas).toBeCloseTo(0.15, 8);

    const oneBaseUnitShort = getLastSurvivorTransactionGate(input({
      estimatedCostGas: 0.30000001,
      prepaidCredit: 0.1,
      walletGasBalance: 0.2,
    }));
    expect(oneBaseUnitShort.reason).toBe("insufficient-gas");

    const floatEqual = getLastSurvivorTransactionGate(input({
      estimatedCostGas: 0.3,
      prepaidCredit: 0.1,
      walletGasBalance: 0.2,
    }));
    expect(floatEqual.reason).toBe("ready");
  });

  it("makes service, lifecycle and inactive-round blockers explicit", () => {
    expect(getLastSurvivorTransactionGate(input({ roundDataAvailable: false })).reason)
      .toBe("service-unavailable");

    const settle = getLastSurvivorTransactionGate(input({
      isRoundActive: false,
      needsLifecycleSync: true,
    }));
    expect(settle.reason).toBe("settle-required");
    expect(settle.settleEnabled).toBe(true);

    const waiting = getLastSurvivorTransactionGate(input({ isRoundActive: false }));
    expect(waiting.reason).toBe("round-waiting");
    expect(waiting.primaryEnabled).toBe(false);
  });

  it("fails closed when wallet reads or durable recovery storage are unavailable", () => {
    expect(getLastSurvivorTransactionGate(input({ writeDataAvailable: false })).reason)
      .toBe("financial-state-unavailable");
    expect(getLastSurvivorTransactionGate(input({ storageHealthy: false })).reason)
      .toBe("recovery-storage-unavailable");
  });

  it("locks presets during buy, settle and round refresh lifecycles", () => {
    for (const overrides of [
      { isBuyingKeys: true },
      { purchasePending: true },
      { isSettling: true },
      { isLoading: true },
    ]) {
      const gate = getLastSurvivorTransactionGate(input(overrides));
      expect(gate.primaryEnabled).toBe(false);
      expect(gate.presetsEnabled).toBe(false);
    }

    const connecting = getLastSurvivorTransactionGate(input({ isConnectingWallet: true }));
    expect(connecting.reason).toBe("connecting");
    expect(connecting.primaryEnabled).toBe(false);
    expect(connecting.presetsEnabled).toBe(false);
    expect(getLastSurvivorTransactionGate(input({ purchasePending: true })).reason)
      .toBe("confirming");
  });

  it("rejects invalid selected counts before any action dispatch", () => {
    expect(getLastSurvivorTransactionGate(input({ selectedCount: 0 })).reason)
      .toBe("invalid-selection");
    expect(getLastSurvivorTransactionGate(input({ selectedCount: 1001 })).reason)
      .toBe("invalid-selection");
    expect(getLastSurvivorTransactionGate(input({ hasValidationError: true })).reason)
      .toBe("invalid-selection");
  });
});
