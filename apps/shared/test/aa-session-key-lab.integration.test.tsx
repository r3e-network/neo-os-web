import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-session-key-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) { return key; }

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults = {
    accountReadStatus: "idle",
    sessionReadStatus: "idle",
    allowanceSupported: true,
    canConfigure: false,
    canRevoke: false,
    isCheckingSponsorship: false,
    isInspecting: false,
    isRecovering: false,
    isRevoking: false,
    isSubmitting: false,
    pendingWrite: null,
    verifierBound: false,
    writePhase: "idle",
    ...values,
  };
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("aa-session-key-lab integration", () => {
  it("renders the designed permission workspace", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".sess-object")).toBeTruthy();
    expect(container.querySelector(".sess-visual-card img")).toBeTruthy();
  });

  it("routes the initial primary action to live account inspection", async () => {
    const accountId = "0xcbc8faecd19d509790e8e32e25791602aa278705";
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ launchAccountId: accountId })} dispatch={dispatch} />);
    const button = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("inspectSession", accountId));
  });

  it("does not invent an AccountId when none was supplied", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const button = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("has a reduced-motion guard in the scoped stylesheet", () => {
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const css = readFileSync(path.join(appsRoot, "aa-session-key-lab/src/PlayArea.scss"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
