import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../recovery-guardian/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) { return key; }
function state(values: Record<string, unknown>): ObservableState {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("recovery-guardian integration", () => {
  it("dispatches one profile read from the primary journey action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          profileInput: `0x${"11".repeat(20)}`,
          journeyState: "idle",
          recoveryExpiryMinutes: "30",
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-btn--primary")!);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("loadProfile"));
  });
});
