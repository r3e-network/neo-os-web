import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../trustanchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
const t = (key: string) => key;

function state(overrides: Record<string, unknown> = {}): ObservableState {
  const values = {
    network: "mainnet",
    contract: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
    readStatus: "ready",
    stats: { mode: "1", totalStaked: "0", totalStakers: "0", rewardPerNeo: "0", rewardReserve: "0", agentCount: "21", selectedAgentId: "0", paused: false },
    user: null,
    pendingTransaction: null,
    history: [],
    actionStatus: "transactionIdle",
    actionError: "",
    readError: "",
    diagnosticError: "",
    storageHealthy: true,
    submitting: false,
    confirmationChecking: false,
    walletAddress: "",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("trustanchor PlayArea production surface", () => {
  it("uses the real governance artwork and no inline SVG/CSS-art route nodes", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector<HTMLImageElement>(".trust-visual__image")?.getAttribute("src")).toContain("trustanchor-stage.webp");
    expect(container.querySelector(".trust-product-scene svg")).toBeNull();
    expect(container.querySelector(".trust-scene__node, .trust-scene__orbit, .trust-scene__backdrop")).toBeNull();
    expect(container.querySelector(".trust-command")).toBeTruthy();
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
  });

  it("uses unavailable placeholders instead of zero when live reads are absent", () => {
    const { container } = render(<PlayArea t={t} state={state({ readStatus: "read-unavailable", stats: null, user: null })} dispatch={vi.fn()} />);
    expect(container.querySelector(".mx2-score")?.textContent).toContain("—");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    expect(container.querySelector(".trust-binding")?.textContent).toBe("bindingReadUnavailable");
  });

  it("shows a durable pending state and recovers without exposing another stake action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pending = {
      version: 2, network: "mainnet", contract: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
      appId: "miniapp-trustanchor", expectedMode: 1, walletHash: `0x${"11".repeat(20)}`,
      action: "stake", amount: "1", beforeStake: "0", beforeRewards: "0", beforeCredit: "0",
      expectedStake: "1", txid: `0x${"ab".repeat(32)}`, createdAt: Date.now(),
    };
    const { container } = render(<PlayArea t={t} state={state({ pendingTransaction: pending })} dispatch={dispatch} />);
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".trust-drawer__nav button")[2]);
    fireEvent.click(container.querySelector(".mx2-open-notice button") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("recoverPendingAnchor");
  });

  it("keeps a clean, bright, responsive foreground and reduced motion", () => {
    const styles = readFileSync(
      resolve(
        process.cwd().endsWith("/apps/shared") ? process.cwd() : resolve(process.cwd(), "apps/shared"),
        "../trustanchor/src/PlayArea.scss",
      ),
      "utf8",
    );
    expect(styles).toMatch(/\.trust-product-scene\s*\{[\s\S]*grid-template-columns:/);
    expect(styles).toMatch(/\.trust-visual__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/background:\s*#fffdf8/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)/);
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).not.toMatch(/radial-gradient|linear-gradient|backdrop-filter/);
  });
});
