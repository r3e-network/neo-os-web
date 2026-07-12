import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-relay-console/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) { return key; }
function state(values: Record<string, unknown>): ObservableState {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("AA Relay Console lifecycle state integration", () => {
  it("keeps relay acceptance distinct from chain confirmation", () => {
    const { container } = render(<PlayArea
      t={t}
      dispatch={vi.fn()}
      state={state({
        aaAddressInput: "",
        dappIdInput: "",
        payloadInput: "",
        reviewReadiness: "review-ready",
        reviewJobId: "aa-123456789abc",
        preparedFingerprint: "different-draft",
        sponsorState: "not-checked",
        sponsorSummary: "sponsorNotChecked",
        receiptStatus: "accepted",
        chainStatus: "accepted",
        chainReason: "accepted-without-broadcast-proof",
        confirmationsDisplay: "0",
        aaCoreDisplay: `0x${"11".repeat(20)}`,
        paymasterDisplay: "notPublished",
        networkDisplay: "mainnet",
        runtimeMode: "review-only",
        hasReview: true,
        hasReceipt: true,
        hasTrackableReceipt: false,
        isPreparing: false,
        isCheckingSponsorship: false,
        isTracking: false,
      })}
    />);

    expect(container.textContent).toContain("receiptAccepted");
    expect(container.textContent).not.toContain("chainConfirmed");
    expect(container.querySelector(".aa-relay-scene__status")?.getAttribute("data-state")).toBe("accepted");
  });

  it("renders a fault as a terminal error state rather than success", () => {
    const { container } = render(<PlayArea
      t={t}
      dispatch={vi.fn()}
      state={state({
        reviewReadiness: "review-ready",
        chainStatus: "fault",
        chainReason: "Verifier rejected signature",
        confirmationsDisplay: "1",
        networkDisplay: "testnet",
        runtimeMode: "review-only",
        hasReview: true,
        hasReceipt: true,
        hasTrackableReceipt: true,
        isPreparing: false,
        isCheckingSponsorship: false,
        isTracking: false,
      })}
    />);

    expect(container.textContent).toContain("chainFault");
    expect(container.textContent).toContain("Verifier rejected signature");
    expect(container.textContent).not.toContain("chainConfirmed");
    expect(container.querySelector(".aa-relay-scene__status")?.getAttribute("data-state")).toBe("fault");
  });
});
