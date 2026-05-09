import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../neo-pay/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    totalStreams: "Total Streams",
    active: "Active",
    createdByYou: "Created by You",
    youAreBeneficiary: "You're Beneficiary",
    createStream: "Create Stream",
    recipient: "Recipient Address",
    recipientPlaceholder: "N3 address...",
    amount: "Amount",
    duration: "Duration",
    durationPlaceholder: "Number of days",
    days: "days",
    token: "Token",
    yourCreatedStreams: "Your Created Streams",
    streamsYouReceive: "Streams You Receive",
    noCreatedStreams: "You haven't created any streams yet",
    noBeneficiaryStreams: "No incoming streams",
  };
  return messages[key] ?? key;
}

function state(): ObservableState {
  return {
    createdStreams: createObservable([]),
    beneficiaryStreams: createObservable([]),
    allStreams: createObservable([]),
    isLoading: createObservable(false),
    isCreating: createObservable(false),
    isRefreshing: createObservable(false),
    activeCount: createObservable(0),
    createdStreamCount: createObservable(0),
    beneficiaryStreamCount: createObservable(0),
    totalStreamCount: createObservable(0),
  };
}

describe("NeoPay PlayArea launch params", () => {
  it("prefills a OneGate payment scan into the stream form", () => {
    render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay/index.html?source=onegate&operation=pay&network=testnet&recipient=NtestRecipient111111111111111111111111111&amount=1.25&duration=7&token=GAS",
          "miniapp-neo-pay",
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Recipient Address") as HTMLInputElement).value,
    ).toBe("NtestRecipient111111111111111111111111111");
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
      "1.25",
    );
    expect((screen.getByLabelText("Duration") as HTMLInputElement).value).toBe(
      "7",
    );
    expect(
      (screen.getByRole("button", { name: "Create Stream" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
