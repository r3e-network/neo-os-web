import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../council-governance/src/PlayArea";
import { messages } from "../../council-governance/src/locale/messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const entry = (messages as Record<string, { en?: string }>)[key];
  let value = entry?.en ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    isLoading: false,
    isVoting: false,
    isCreating: false,
    isCandidate: true,
    candidateLoaded: true,
    address: "NZCouncilCandidate111111111111111111111",
    totalProposals: 0,
    activeCount: 0,
    historyCount: 0,
    proposals: [],
    activeProposals: [],
    historyProposals: [],
    hasVotedMap: {},
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Council Governance PlayArea", () => {
  it("requires policy details before enabling a policy proposal submit", async () => {
    const dispatch = vi.fn(async () => ({ txid: "0xcreate" }));
    render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={dispatch}
        retryLoad={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Create Proposal/i }));

    const submit = screen.getByRole("button", {
      name: "Submit Proposal",
    }) as HTMLButtonElement;
    const floor = screen.getByRole("region", { name: "Council floor" });
    expect(floor.className).toContain("council-floor-stage--idle");
    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText("Please enter a title and description"),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Approve oracle reliability budget" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: {
        value:
          "Allocate maintenance funding to oracle monitoring and incident response.",
      },
    });
    expect(submit.disabled).toBe(false);
    expect(floor.className).toContain("council-floor-stage--ready");
    expect(screen.getByText("Ready for council review")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Policy Change/i }));
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Select a policy method and value")).toBeTruthy();
    expect(floor.className).toContain("council-floor-stage--draft");
    const policyValue = screen.getByLabelText(
      "Policy Value",
    ) as HTMLInputElement;
    expect(policyValue.type).toBe("text");
    expect(policyValue.inputMode).toBe("numeric");
    expect(policyValue.getAttribute("pattern")).toBe("[0-9]*");

    fireEvent.change(policyValue, {
      target: { value: "90000" },
    });
    expect(submit.disabled).toBe(false);
    expect(floor.className).toContain("council-floor-stage--ready");

    fireEvent.click(submit);
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch).toHaveBeenCalledWith(
      "createProposal",
      expect.objectContaining({
        type: 1,
        title: "Approve oracle reliability budget",
        policyMethod: "FeePerByte",
        policyValue: "90000",
        duration: 7 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it("keeps proposal publishing visible instead of replacing the CTA with a bare spinner", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ isCreating: true })}
        dispatch={vi.fn()}
        retryLoad={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Create Proposal/i }));

    const floor = screen.getByRole("region", { name: "Council floor" });
    const submit = screen.getByRole("button", {
      name: "Submitting proposal...",
    });

    expect(floor.className).toContain("council-floor-stage--publishing");
    expect(floor.getAttribute("aria-busy")).toBe("true");
    expect(
      container.querySelector(".council-submit-button__spinner"),
    ).toBeTruthy();
    expect(submit.textContent).toContain("Submitting proposal...");
  });

  it("covers council floor motion and reduced-motion fallback", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../council-governance/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes council-floor-sweep");
    expect(styles).toContain("@keyframes council-floor-packet");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.council-floor-stage::before[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.council-submit-button__spinner[\s\S]*animation:\s*none/,
    );
  });
});
