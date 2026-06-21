import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
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
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Council Governance PlayArea", () => {
  it("requires policy details before enabling a policy proposal submit", async () => {
    const dispatch = vi.fn(async () => ({ txid: "0xcreate" }));
    render(<PlayArea t={t} state={state()} dispatch={dispatch} retryLoad={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: /Create Proposal/i }));

    const submit = screen.getByRole("button", { name: "Submit Proposal" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Please enter a title and description")).toBeTruthy();

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

    fireEvent.click(screen.getByRole("radio", { name: /Policy Change/i }));
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Select a policy method and value")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Policy Value"), {
      target: { value: "90000" },
    });
    expect(submit.disabled).toBe(false);

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
});
