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
    notes: "Notes (optional)",
    notesPlaceholder: "Add context for the recipient",
    yourCreatedStreams: "Your Created Streams",
    streamsYouReceive: "Streams You Receive",
    noCreatedStreams: "You haven't created any streams yet",
    noBeneficiaryStreams: "No incoming streams",
    to: "To",
    from: "From",
    claimable: "Claimable",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return {
    createdStreams: createObservable([]),
    beneficiaryStreams: createObservable([]),
    allStreams: createObservable([]),
    isLoading: createObservable(false),
    isCreating: createObservable(false),
    isRefreshing: createObservable(false),
    serviceNotice: createObservable(""),
    activeCount: createObservable(0),
    createdStreamCount: createObservable(0),
    beneficiaryStreamCount: createObservable(0),
    totalStreamCount: createObservable(0),
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [
        key,
        createObservable(value),
      ]),
    ),
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
          "https://neomini.app/miniapps/neo-pay/index.html?source=onegate&operation=pay&network=testnet&recipient=NtestRecipient111111111111111111111111111&amount=1.25&duration=7&token=bNEO&notes=Payroll%20cycle",
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
      (screen.getByLabelText("Notes (optional)") as HTMLInputElement).value,
    ).toBe("Payroll cycle");
    expect(screen.queryByRole("button", { name: "bNEO" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "GAS" }).className,
    ).toContain(
      "neopay-token-option--active",
    );
    expect(
      (screen.getByRole("button", { name: "Create Stream" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows a professional stream service notice without raw OS errors", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          serviceNotice:
            "The payment stream index is not available in this environment yet.",
        })}
        dispatch={vi.fn()}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay-shared-example/index.html?source=embed&network=testnet",
          "miniapp-neo-pay-shared-example",
        )}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "The payment stream index is not available",
    );
    expect(screen.getByRole("button", { name: "Create Stream" })).toBeTruthy();
    expect(screen.queryByText(/OS service error|os-vesting-list|Not Found/i)).toBeNull();
  });

  it("renders OS stream records with business fields and fixed8 amounts", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          createdStreams: [
            {
              id: "42",
              creator: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
              beneficiary: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
              assetSymbol: "GAS",
              totalAmount: 2000000000n,
              releasedAmount: 500000000n,
              remainingAmount: 1500000000n,
              rateAmount: 100000000n,
              intervalSeconds: 86400n,
              intervalDays: 1,
              status: "active",
              claimable: 0n,
              title: "Payroll May",
              notes: "Engineering monthly payroll",
            },
          ],
          beneficiaryStreams: [
            {
              id: "43",
              creator: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
              beneficiary: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
              assetSymbol: "GAS",
              totalAmount: 300000000n,
              releasedAmount: 150000000n,
              remainingAmount: 150000000n,
              rateAmount: 50000000n,
              intervalSeconds: 86400n,
              intervalDays: 1,
              status: "active",
              claimable: 150000000n,
              title: "Subscription",
              notes: "Contributor stipend",
            },
          ],
        })}
        dispatch={vi.fn()}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay/index.html?source=embed&network=testnet",
          "miniapp-neo-pay",
        )}
      />,
    );

    expect(screen.getByText("Payroll May")).toBeTruthy();
    expect(screen.getByText("Engineering monthly payroll")).toBeTruthy();
    expect(screen.getAllByText(/20 GAS/).length).toBeGreaterThan(0);
    expect(screen.getByText("5 / 20 GAS (25%)")).toBeTruthy();
    expect(screen.getByText("Subscription")).toBeTruthy();
    expect(screen.getByText("Contributor stipend")).toBeTruthy();
    expect(screen.getByText("1.5 GAS")).toBeTruthy();
    expect(screen.queryByText(/2000000000 GAS|300000000 GAS/)).toBeNull();
  });
});
