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
    buildRecipe: "Build Recipe",
    currentPrice: "Current Price",
    docSubtitle: "Inspect live data, assemble a recipe, and keep pricefeed separated from slower jobs.",
    fetchPrice: "Fetch Price",
    flowStateDraft: "Draft route",
    flowStateRegistering: "Registering trigger",
    latestPrice: "Latest Price",
    priceRule: "Price rule",
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
    const { container } = render(<PlayArea t={t} state={state({ currentPrice: "18.42", targetPrice: "20", latestTriggerState: "Draft" })} dispatch={vi.fn()} />);

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
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("Register Trigger"));
    fireEvent.click(screen.getByText("Fetch Price"));
    fireEvent.click(screen.getByText("Build Recipe"));

    expect(dispatch).toHaveBeenCalledWith("registerTrigger");
    expect(dispatch).toHaveBeenCalledWith("fetchCurrentPrice");
    expect(dispatch).toHaveBeenCalledWith("buildRecipePayload");
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
