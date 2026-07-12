import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../automation-copilot/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string, p?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionPlan: "Action plan",
    asset: "Asset",
    automationActions: "Automation Actions",
    automationRoute: "Automation route",
    automationStudio: "Automation studio",
    buildRecipe: "Build Recipe",
    confirmDeleteTrigger: "Confirm delete",
    currentPrice: "Current Price",
    deleteTrigger: "Delete",
    docSubtitle: "Inspect live data, assemble a recipe, and keep pricefeed separated from slower jobs.",
    fetchPrice: "Fetch Price",
    flowStateDraft: "Draft route",
    flowStateRegistering: "Registering trigger",
    latestPrice: "Latest Price",
    presetProtectHint: "NEO · every 6 hours",
    presetProtectTitle: "Protect a loan",
    presetRebalanceHint: "NEO · hourly",
    presetRebalanceTitle: "Rebalance a vault",
    presetRewardsHint: "GAS · daily",
    presetRewardsTitle: "Harvest rewards",
    priceRule: "Price rule",
    priceFresh: "Fresh feed",
    priceNotLoaded: "Not loaded",
    refreshPrice: "Refresh price",
    recipePreview: "Recipe preview",
    recipePreviewLine: `Watch ${p?.asset ?? "NEO"} around ${p?.price ?? "20"}, then run the selected action.`,
    registerTrigger: "Register Trigger",
    routeOperate: "Enable or disable",
    routePrice: "Read pricefeed",
    routeRegister: "Register trigger",
    schedule: "Schedule",
    schedulePresetEvery6h: "Every 6h",
    targetPrice: "Target Price",
    triggerCount: "Verified Triggers",
  };
  return messages[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
describe("automation-copilot PlayArea (v2)", () => {
  it("renders a foreground automation rule board instead of a backdrop scene", () => {
    const { container } = render(<PlayArea t={t} state={state({ currentPrice: "$18.4200", priceFreshnessState: "fresh", targetPrice: "20", latestTriggerState: "Draft" })} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__rule-board")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__price-gate")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__flow")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__action-card")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__backdrop")).toBeFalsy();
    expect(screen.getByText("Register Trigger")).toBeTruthy();
    expect(screen.getByText("Auto Repay Self Loan")).toBeTruthy();
    expect(container.textContent).not.toMatch(/🎯/);
  });

  it("dispatches primary and secondary automation actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ currentPrice: "$18.4200", priceFreshnessState: "fresh" })} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("Register Trigger"));
    fireEvent.click(screen.getByText("Refresh price"));
    fireEvent.click(screen.getByText("Automation studio"));
    fireEvent.click(screen.getByText("Build Recipe"));

    expect(dispatch).toHaveBeenCalledWith("registerTrigger");
    expect(dispatch).toHaveBeenCalledWith("fetchCurrentPrice");
    expect(dispatch).toHaveBeenCalledWith("buildRecipePayload");
  });

  it("makes feed freshness the first primary step before registration", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ priceFreshnessState: "unloaded" })} dispatch={dispatch} />);

    expect(screen.queryByText("Register Trigger")).toBeNull();
    fireEvent.click(screen.getByText("Fetch Price"));

    expect(dispatch).toHaveBeenCalledWith("fetchCurrentPrice");
    expect(dispatch).not.toHaveBeenCalledWith("registerTrigger");
  });

  it("configures a complete automation from visual presets instead of a first-screen form", () => {
    const appState = state({
      asset: "NEO",
      targetPrice: "20",
      schedule: "0 */6 * * *",
      actionName: "auto_repay_self_loan",
    });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);

    expect(container.querySelector(".copilot-scene__preset-deck")).toBeTruthy();
    expect(container.querySelector(".copilot-scene__art-card img")).toBeTruthy();
    expect(container.querySelector(".copilot-scene input")).toBeNull();

    fireEvent.click(screen.getByText("Harvest rewards"));

    expect(appState.asset.get()).toBe("GAS");
    expect(appState.targetPrice.get()).toBe("8");
    expect(appState.schedule.get()).toBe("0 9 * * *");
    expect(appState.actionName.get()).toBe("claim_rewards");
  });

  it("requires a deliberate second click before deleting a verified trigger", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const verified = {
      id: "trigger-1",
      name: "Protect NEO loan",
      trigger_type: "threshold",
      enabled: true,
      created_at: "2026-07-11T00:00:00.000Z",
    };
    render(<PlayArea t={t} state={state({
      triggers: [verified],
      triggersLoaded: true,
      latestTrigger: verified,
      triggerCount: 1,
    })} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("Automation studio"));
    fireEvent.click(screen.getByText("Delete"));
    expect(dispatch).not.toHaveBeenCalledWith("deleteTrigger", "trigger-1");

    fireEvent.click(screen.getByText("Confirm delete"));
    expect(dispatch).toHaveBeenCalledWith("deleteTrigger", "trigger-1");
  });

  it("keeps automation styling foreground-led, animated, and motion guarded", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../automation-copilot/src/PlayArea.scss`, "utf8");

    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.copilot-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.copilot-scene__rule-board\s*\{[\s\S]*grid-template-columns/);
    expect(s).toMatch(/@keyframes copilot-gauge-pulse/);
    expect(s).toMatch(/@keyframes copilot-connector-run/);
    expect(s).toMatch(/\.automation-copilot-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 188px/);
    expect(s).not.toMatch(/AI-generated scene backdrop/);
    expect(s).not.toMatch(/copilot-scene__backdrop|background-image:\s*url|var\(--mx2-scene-wash/);
    expect(s).not.toMatch(/\.bridge-scene__backdrop/);
  });
});
