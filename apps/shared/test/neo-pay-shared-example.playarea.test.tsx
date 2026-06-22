import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../neo-pay-shared-example/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    active: "Active",
    amount: "Amount",
    cancel: "Cancel",
    claim: "Claim",
    claimable: "Claimable",
    createStream: "Create Stream",
    createdByYou: "Created by You",
    days: "days",
    duration: "Duration",
    durationPlaceholder: "Number of days",
    from: "From",
    intervalLabel: "Interval",
    invalidAddress: "Enter a valid Neo N3 address",
    invalidAmount: "Enter an amount",
    noBeneficiaryStreams: "No incoming streams",
    noCreatedStreams: "No outgoing streams",
    notes: "Notes (optional)",
    notesPlaceholder: "Add context for the recipient",
    rateAmount: "Release per interval",
    rateRoundsToZero:
      "Amount is too small for this duration — increase the amount or shorten the duration.",
    readyForWallet: "Ready for wallet signing",
    recipient: "Recipient Address",
    recipientPlaceholder: "N3 address...",
    releasePerDay: "Release per day",
    reviewStream: "Complete stream details",
    sharedPaymentStage: "Shared payment stream stage",
    sharedRouteLabel: "Shared module route",
    sharedRuntime: "Shared runtime",
    sharedRuntimeProofs: "Shared runtime proofs",
    sharedStreamRoute: "Shared stream route",
    sharedRuntimeSubtitle:
      "Create a funded payment stream through the shared vault and vesting modules.",
    sharedRuntimeTitle: "NeoPay shared streams",
    sharedVault: "Shared vault",
    stageDraft: "Drafting stream",
    stageIdle: "Ready to plan",
    stageLive: "Streams live",
    stageReady: "Ready to sign",
    stageSigning: "Signing stream",
    streamListUnavailableTitle: "Stream index unavailable",
    streamSingular: "Stream",
    streamsYouReceive: "Streams You Receive",
    token: "Token",
    totalAmount: "Total amount",
    totalStreams: "Total Streams",
    transactionPreview: "Transaction preview",
    vaultName: "Stream name",
    vaultNamePlaceholder: "Monthly payroll stream",
    youAreBeneficiary: "You're Beneficiary",
    yourCreatedStreams: "Your Created Streams",
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

function renderSharedPlayArea(
  overrides: Partial<Record<string, unknown>> = {},
  dispatch = vi.fn().mockResolvedValue(undefined),
) {
  const view = render(
    <PlayArea
      t={t}
      state={state(overrides)}
      dispatch={dispatch}
      launchContext={parseMiniAppLaunchContext(
        "https://neomini.app/miniapps/neo-pay-shared-example/index.html?source=embed&network=testnet",
        "miniapp-neo-pay-shared-example",
      )}
    />,
  );
  return { ...view, dispatch };
}

describe("NeoPay shared runtime PlayArea", () => {
  it("renders an asset-led shared-runtime stage before the composer", () => {
    const { container } = renderSharedPlayArea({
      totalStreamCount: 3,
      activeCount: 2,
      createdStreamCount: 1,
      beneficiaryStreamCount: 2,
    });

    expect(screen.getByText("NeoPay shared streams")).toBeTruthy();
    expect(screen.getByLabelText("Shared payment stream stage")).toBeTruthy();
    expect(screen.getByLabelText("Shared stream route")).toBeTruthy();
    expect(screen.getByText("Shared module route")).toBeTruthy();
    expect(screen.getByText("Shared vault")).toBeTruthy();
    expect(screen.getByText("Streams live")).toBeTruthy();

    const stageImage = container.querySelector<HTMLImageElement>(
      ".shared-pay-stage__media img",
    );
    expect(stageImage?.getAttribute("src")).toBe("banner.jpg");
    const routeLogos = container.querySelectorAll<HTMLImageElement>(
      ".shared-pay-route-token img, .shared-pay-route-vault__logo img",
    );
    expect(routeLogos).toHaveLength(3);
    routeLogos.forEach((logo) => {
      expect(logo.getAttribute("src")).toBe("logo.jpg");
    });

    expect(screen.getByLabelText("Stream name")).toBeTruthy();
    expect(screen.getByLabelText("Recipient Address")).toBeTruthy();
    expect(screen.getByLabelText("Amount")).toBeTruthy();
    expect(screen.getByLabelText("Duration")).toBeTruthy();
    expect(screen.getByLabelText("Token")).toBeTruthy();
    // Stream presets are rendered as quick-fill buttons. The standalone
    // MiniAppNeoPay contract supports NEO + GAS, so the GAS presets are joined
    // by a "90d NEO" preset (90 NEO over 90 days = exactly 1 NEO/day).
    expect(screen.getByRole("button", { name: "7d GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "30d GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "90d NEO" })).toBeTruthy();
  });

  it("dispatches the configured shared stream intent", async () => {
    const { dispatch, container } = renderSharedPlayArea();

    fireEvent.change(screen.getByLabelText("Stream name"), {
      target: { value: "Ops stipend" },
    });
    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1.4" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), {
      target: { value: "Weekly operations release" },
    });

    expect(
      container.querySelector(".shared-pay-stage")?.className,
    ).toContain("shared-pay-stage--ready");
    expect(screen.getAllByText("1.4 GAS").length).toBeGreaterThan(0);
    expect(screen.getByText("Ready to sign")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create Stream" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createStream", {
        recipient: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        amount: "1.4",
        duration: "7",
        token: "GAS",
        title: "Ops stipend",
        notes: "Weekly operations release",
      }),
    );
  });

  it("previews the exact rounded per-day rate the dispatch will send", () => {
    // 0.7 GAS over 7 days is the 7d-GAS preset and the canonical float-precision
    // case: 0.7/7 = 0.0999999999999999 as a raw float. The preview must show the
    // representable rounded rate (0.1) and the daily interval (1 day), matching
    // what deriveSchedule hands to the contract — not the misleading raw float.
    renderSharedPlayArea();

    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0.7" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "7" },
    });

    // Daily model -> "Release per day", value "0.1 GAS", interval "1 days".
    expect(screen.getAllByText("Release per day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.1 GAS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 days").length).toBeGreaterThan(0);
    // Stream is submittable (rate does not round to zero).
    expect(
      (screen.getByRole("button", { name: "Create Stream" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("blocks submit and warns when the GAS rate rounds to zero", () => {
    // 0.0000001 GAS over 30 days -> per-day < 1e-8 -> toFixed(8) = "0.00000000",
    // which the contract would reject. The form must block submit and warn
    // instead of implying a submittable tidy rate.
    const { dispatch } = renderSharedPlayArea();

    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0.0000001" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "30" },
    });

    expect(
      screen.getByText(
        "Amount is too small for this duration — increase the amount or shorten the duration.",
      ),
    ).toBeTruthy();
    const submit = screen.getByRole("button", {
      name: "Complete stream details",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders existing streams with cancel and claim actions", () => {
    const { dispatch } = renderSharedPlayArea({
      createdStreams: [
        {
          id: "21",
          beneficiary: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          assetSymbol: "GAS",
          totalAmount: 700000000n,
          releasedAmount: 200000000n,
          remainingAmount: 500000000n,
          intervalDays: 7,
          status: "active",
          title: "Ops stream",
          notes: "Weekly release",
        },
      ],
      beneficiaryStreams: [
        {
          id: "22",
          creator: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          assetSymbol: "GAS",
          totalAmount: 500000000n,
          releasedAmount: 100000000n,
          remainingAmount: 400000000n,
          claimable: 100000000n,
          intervalDays: 5,
          status: "active",
          title: "Contributor stream",
        },
      ],
    });

    expect(screen.getByText("Ops stream")).toBeTruthy();
    expect(screen.getByText("2 / 7 GAS (29%)")).toBeTruthy();
    expect(screen.getByText("Contributor stream")).toBeTruthy();
    expect(screen.getByText("1 GAS")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    expect(dispatch).toHaveBeenCalledWith("cancelStream", "21");
    expect(dispatch).toHaveBeenCalledWith("claimStream", "22");
  });

  it("keeps the shared runtime stage animated with reduced-motion safeguards", () => {
    const styles = readFileSync(
      resolve(__dirname, "../../neo-pay-shared-example/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes shared-pay-stage-drift");
    expect(styles).toContain("@keyframes shared-pay-route-token-run");
    expect(styles).toMatch(
      /\.shared-pay-stage__media\s*\{[\s\S]*?img\s*\{[\s\S]*?animation:\s*shared-pay-stage-drift/u,
    );
    expect(styles).toMatch(
      /\.shared-pay-route-token\s*\{[\s\S]*?animation:\s*shared-pay-route-token-run/u,
    );
    expect(styles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.shared-pay-route-token[\s\S]*?animation:\s*none/u,
    );
  });
});
