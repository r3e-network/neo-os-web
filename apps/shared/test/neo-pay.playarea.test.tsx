import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    heroEyebrow: "Payment streams",
    heroTitle: "Stream payments over time",
    heroSubtitle: "Lock GAS or NEO and release it on a schedule",
    paymentStageAria: "Payment stream stage",
    streamFlowPreview: "Payment stream preview",
    stagedFlow: "Live stream route",
    payerWallet: "Your wallet",
    streamVault: "Stream vault",
    stageIdle: "Ready to plan",
    stageDraft: "Drafting stream",
    stageReady: "Ready to sign",
    stageSigning: "Signing stream",
    stageLive: "Streams live",
    createdByYou: "Created by You",
    youAreBeneficiary: "You're Beneficiary",
    createStream: "Create Stream",
    creatingStream: "Creating stream...",
    streamConsole: "Stream console",
    recipient: "Recipient Address",
    recipientPlaceholder: "N3 address...",
    amount: "Amount",
    duration: "Duration",
    durationPlaceholder: "Number of days",
    days: "days",
    token: "Token",
    notes: "Notes (optional)",
    notesPlaceholder: "Add context for the recipient",
    reviewStream: "Complete stream details",
    yourCreatedStreams: "Your Created Streams",
    streamsYouReceive: "Streams You Receive",
    noCreatedStreams: "You haven't created any streams yet",
    noBeneficiaryStreams: "No incoming streams",
    to: "To",
    from: "From",
    cancel: "Cancel",
    claim: "Claim",
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
  it("leads with a real payment-stream stage instead of a form wall", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay/index.html?source=embed&network=testnet",
          "miniapp-neo-pay",
        )}
      />,
    );

    const stage = screen.getByLabelText("Payment stream stage");
    const composer = container.querySelector(".neopay-card--form");
    expect(stage.querySelector('img[src="./banner.jpg"]')).toBeTruthy();
    expect(stage.querySelector(".neopay-flow-token")).toBeTruthy();
    expect(composer).toBeTruthy();
    expect(
      stage.compareDocumentPosition(composer as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

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
    expect(screen.getByLabelText("Payment stream stage").className).toContain(
      "neopay-stream-stage--ready",
    );
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
    expect(
      screen.getByRole("button", { name: "Complete stream details" }),
    ).toBeTruthy();
    expect(screen.queryByText(/OS service error|os-vesting-list|Not Found/i)).toBeNull();
  });

  it("keeps the createStream payload at the PlayArea boundary", async () => {
    let resolveDispatch: () => void = () => {};
    const dispatch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDispatch = resolve;
        }),
    );
    const { container } = render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={dispatch}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay/index.html?source=embed&network=testnet",
          "miniapp-neo-pay",
        )}
      />,
    );

    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: "  NtestRecipient111111111111111111111111111  " },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1.25" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Stream" }));

    expect(container.querySelector(".neopay-stream-stage--creating")).toBeTruthy();
    expect(dispatch).toHaveBeenCalledWith("createStream", {
      recipient: "  NtestRecipient111111111111111111111111111  ",
      amount: "1.25",
      duration: "7",
      token: "GAS",
      notes: "",
    });

    resolveDispatch();
    await waitFor(() => {
      expect(container.querySelector(".neopay-stream-stage--creating")).toBeNull();
    });
  });

  it("keeps the visual motion accessible and reduced-motion aware", () => {
    const css = readFileSync(
      resolve(__dirname, "../../neo-pay/src/PlayArea.scss"),
      "utf8",
    );

    expect(css).toContain("@keyframes neopay-flow-token");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.neopay-flow-token[\s\S]*animation:\s*none/,
    );
    expect(css).toMatch(
      /\.neopay-stream-stage__image\s*\{[\s\S]*animation:\s*neopay-stage-drift/,
    );
  });

  it("still dispatches claim and cancel through the existing stream actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          createdStreams: [
            {
              id: "42",
              beneficiary: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
              assetSymbol: "GAS",
              totalAmount: 2000000000n,
              releasedAmount: 500000000n,
              remainingAmount: 1500000000n,
              rateAmount: 100000000n,
              intervalDays: 1,
              status: "active",
            },
          ],
          beneficiaryStreams: [
            {
              id: "43",
              creator: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
              assetSymbol: "GAS",
              totalAmount: 300000000n,
              releasedAmount: 150000000n,
              remainingAmount: 150000000n,
              rateAmount: 50000000n,
              intervalDays: 1,
              status: "active",
              claimable: 150000000n,
            },
          ],
        })}
        dispatch={dispatch}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/neo-pay/index.html?source=embed&network=testnet",
          "miniapp-neo-pay",
        )}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    expect(dispatch).toHaveBeenCalledWith("cancelStream", "42");
    expect(dispatch).toHaveBeenCalledWith("claimStream", "43");
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
