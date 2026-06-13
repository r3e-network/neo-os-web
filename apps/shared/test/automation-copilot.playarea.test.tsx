import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../automation-copilot/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    actionName: "Action Name",
    apiIdle: "Ready",
    asset: "Asset",
    automationGatewayHint:
      "Registration is sent through the host automation gateway.",
    automationRoute: "Automation route",
    buildRecipe: "Build Recipe",
    copyPayload: "Copy Payload",
    currentPrice: "Current Price",
    datafeedHash: "Datafeed",
    disabled: "Disabled",
    disableTrigger: "Disable Trigger",
    enabled: "Enabled",
    enableTrigger: "Enable Trigger",
    fetchPrice: "Fetch Price",
    latestResult: "Latest Result",
    latestTriggerId: "Latest Trigger",
    network: "Network",
    nextExecution: "Next Execution",
    noTriggerSelected: "Register or refresh a trigger to see its status.",
    oracleHash: "Oracle",
    payload: "Payload",
    payloadEmpty: "Fetch a price or build a recipe first.",
    recipeBuilder: "Recipe Builder",
    refreshTriggers: "Refresh",
    registerTrigger: "Register Trigger",
    routeOperate: "Enable or disable",
    routePrice: "Read pricefeed",
    routeRegister: "Register trigger",
    schedule: "Schedule",
    subtitle: "Create and operate price-triggered Morpheus automation triggers.",
    targetPrice: "Target Price",
    title: "Automation Copilot",
    triggerCount: "Verified Triggers",
    triggerRequestEmpty: "Build or register a trigger.",
    triggerStatus: "Trigger Status",
    verifyBeforeOperate: "Verify a gateway trigger before enabling or disabling it.",
    manageTriggers: "Manage Triggers",
    deleteTrigger: "Delete",
    activeTrigger: "Active",
    actionRepaySelfLoan: "Repay self-loan",
    actionCustom: "Custom action…",
    actionCustomLabel: "Custom Action Name",
    schedulePresetHourly: "Hourly",
    schedulePresetEvery6h: "Every 6h",
    schedulePresetDaily: "Daily",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    asset: "NEO",
    targetPrice: "20",
    schedule: "0 */6 * * *",
    actionName: "auto_repay_self_loan",
    currentPrice: "$21.0000",
    renderedPayload: "{}",
    renderedTriggerRequest: "{}",
    isRequesting: false,
    isRegistering: false,
    isRefreshing: false,
    oracleHash: "0xoracle",
    networkDisplay: "testnet",
    datafeedHash: "0xdatafeed",
    latestTriggerId: "notAvailable",
    latestTriggerState: "Ready",
    latestTrigger: null,
    triggers: [],
    triggerCount: 0,
    apiStatus: "Ready",
    lastError: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function props(overrides: Partial<React.ComponentProps<typeof PlayArea>> = {}) {
  return {
    t,
    state: state(),
    dispatch: vi.fn(async () => undefined),
    services: { clipboard: { copy: vi.fn(async () => true) } },
    status: null,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/automation-copilot",
      "miniapp-automation-copilot",
    ),
    ...overrides,
  } as React.ComponentProps<typeof PlayArea>;
}

describe("Automation Copilot PlayArea", () => {
  it("dispatches host automation registration from the visible form", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.change(screen.getByLabelText("Target Price"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register Trigger/i }));

    expect(dispatch).toHaveBeenCalledWith("registerTrigger");
  });

  it("shows trigger status controls and does not claim a real trigger for empty state", () => {
    render(<PlayArea {...props()} />);

    expect(screen.getByText("Register or refresh a trigger to see its status.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enable Trigger/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Disable Trigger/i })).toBeNull();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("renders a gateway handoff trigger without enabling status changes", () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        {...props({
          dispatch,
          state: state({
            latestTriggerId: "local-auto-1234567890abcdef",
            latestTriggerState: "Host handoff prepared",
            latestTrigger: {
              id: "local-auto-1234567890abcdef",
              name: "NEO trigger",
              trigger_type: "threshold",
              enabled: false,
              created_at: "2026-06-01T00:00:00.000Z",
              registration_state: "local_automation_intent",
            },
            triggerCount: 0,
            renderedTriggerRequest: JSON.stringify({
              name: "NEO trigger",
              trigger_type: "threshold",
            }, null, 2),
          }),
        })}
      />,
    );

    expect(screen.getByText("local-auto...90abcdef")).toBeTruthy();
    expect(
      screen.getByText("Verify a gateway trigger before enabling or disabling it."),
    ).toBeTruthy();
    const enableButton = screen.getByRole("button", { name: /Enable Trigger/i });
    expect(enableButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(enableButton);
    expect(dispatch).not.toHaveBeenCalledWith("toggleLatestTrigger");
  });

  it("renders the full trigger list and dispatches select + delete per row", () => {
    const dispatch = vi.fn(async () => undefined);
    const triggers = [
      { id: "trig-1", name: "NEO repay", trigger_type: "threshold", enabled: true, created_at: "2026-06-01T00:00:00.000Z" },
      { id: "trig-2", name: "GAS rebalance", trigger_type: "threshold", enabled: false, created_at: "2026-06-02T00:00:00.000Z" },
    ];
    render(
      <PlayArea
        {...props({
          dispatch,
          state: state({
            triggers,
            triggerCount: 2,
            latestTrigger: triggers[0],
            latestTriggerId: "trig-1",
          }),
        })}
      />,
    );

    // Both triggers are listed (previously only the latest was visible).
    expect(screen.getByText("NEO repay")).toBeTruthy();
    expect(screen.getByText("GAS rebalance")).toBeTruthy();

    // Selecting the older trigger makes it active.
    fireEvent.click(screen.getByText("GAS rebalance"));
    expect(dispatch).toHaveBeenCalledWith("selectTrigger", "trig-2");

    // Deleting dispatches the per-row delete with the trigger id.
    fireEvent.click(screen.getByRole("button", { name: /Delete GAS rebalance/i }));
    expect(dispatch).toHaveBeenCalledWith("deleteTrigger", "trig-2");
  });

  it("offers a discoverable action vocabulary and reveals a custom field for unlisted actions", () => {
    render(
      <PlayArea {...props({ state: state({ actionName: "my_custom_action" }) })} />,
    );

    // An unlisted action name flips the select to Custom and reveals the field.
    expect(screen.getByLabelText("Custom Action Name")).toBeTruthy();
    // The select exposes the known preset action.
    expect(screen.getByRole("option", { name: "Repay self-loan" })).toBeTruthy();
  });

  it("fills the schedule field from a preset chip", () => {
    const setSchedule = vi.fn();
    const baseState = state();
    baseState.schedule.set = setSchedule;
    render(<PlayArea {...props({ state: baseState })} />);

    fireEvent.click(screen.getByRole("button", { name: "Every 6h" }));
    expect(setSchedule).toHaveBeenCalledWith("0 */6 * * *");
  });
});
