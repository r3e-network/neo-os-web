import fs from "node:fs";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../breakup-contract/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const PARTNER = `N${"A".repeat(33)}`;
const OTHER = `N${"B".repeat(33)}`;

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    active: "Active",
    broken: "Broken",
    contractDescription:
      "Draft a stake-backed relationship agreement before confirming the wallet intent.",
    contractServiceUnavailableTitle: "Contract index unavailable",
    contractTerms: "Terms",
    contractTermsPlaceholder: "Optional notes",
    contractTitlePlaceholder: "Our covenant",
    createHintDuration: "Pick at least 30 days.",
    createHintPartner: "Enter a valid Neo N3 partner address.",
    createHintReady: "Ready for wallet review.",
    createHintStake: "Choose at least 1 GAS.",
    createHintTitle: "Add a title.",
    contracts: "Contracts",
    createContract: "Create Contract",
    builderStepPartner: "Choose partner",
    builderStepStake: "Lock stake",
    builderStepTerms: "Set terms",
    daysLeft: "Days Left",
    daysSuffix: "Days",
    duration: "Duration",
    durationDays: "Duration",
    durationLabel: "Contract Duration",
    lastSubmittedContract: `Last submitted: ${params?.title ?? ""}`,
    newContract: "New Contract",
    noContracts: "No contracts yet",
    noContractsHint:
      "Created or signed relationship agreements will appear here once the contract index is available.",
    partner: "Partner",
    partnerAddress: "Partner Address",
    partnerInvalid: "Invalid partner address",
    pending: "Pending",
    pactPreview: "Pact preview",
    pactPreviewPartner: "Partner pending",
    pactPreviewTerms: "Draft terms appear here as the agreement takes shape.",
    pactPreviewUntitled: "Untitled pact",
    pactPreviewRule:
      "Both parties review the same stake-backed intent before signing.",
    signContract: "Sign Contract",
    stake: "Stake",
    stakeAmount: "Stake",
    stakeLabel: "Stake Amount",
    stakeOrDurationInvalid:
      "Stake must be at least 1 GAS and duration at least 30 days",
    subtitle: "Relationship stakes on-chain",
    title: "Breakup Contract",
    titleLabel: "Contract Title",
    total: "Total",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  return {
    actionNotice: createObservable(""),
    activeCount: createObservable(0),
    address: createObservable(PARTNER),
    brokenCount: createObservable(0),
    contractCount: createObservable(0),
    contracts: createObservable([]),
    isLoading: createObservable(false),
    lastSubmittedTitle: createObservable(""),
    pendingCount: createObservable(0),
    serviceNotice: createObservable(""),
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [
        key,
        createObservable(value),
      ]),
    ),
  };
}

describe("Breakup Contract PlayArea", () => {
  it("shows professional service copy and no raw chain error text", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          serviceNotice: "Failed to load contracts",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Failed to load contracts",
    );
    // No raw RPC / chain error internals leak into the UI.
    expect(screen.queryByText(/RPC|getPact|Not Found|ASSERT/i)).toBeNull();
    expect(document.querySelector(".breakup-play-area--empty")).toBeTruthy();
    expect(document.querySelector(".breakup-pact-tabletop")).toBeTruthy();
    expect(
      document.querySelector(
        '.breakup-pact-tabletop img[src="./pact-table.jpg"]',
      ),
    ).toBeTruthy();
    expect(document.querySelector(".breakup-pact-document")).toBeTruthy();
    expect(
      document.querySelectorAll(".breakup-pact-lifecycle__step").length,
    ).toBe(4);
    expect(screen.getAllByText("Stake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Duration").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Create Contract" }),
    ).toBeTruthy();
  });

  it("supports presets and inline validation before submit", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Partner Address"), {
      target: { value: "not-a-neo-address" },
    });
    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));
    fireEvent.click(screen.getByRole("button", { name: "30 Days" }));

    expect(screen.getByText("Invalid partner address")).toBeTruthy();
    expect((screen.getByLabelText("Stake") as HTMLInputElement).value).toBe(
      "5",
    );
    expect((screen.getByLabelText("Duration") as HTMLInputElement).value).toBe(
      "30",
    );
  });

  it("turns the pact preview ready once partner, stake, duration, and title are valid", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Partner Address"), {
      target: { value: PARTNER },
    });
    fireEvent.change(screen.getByLabelText("Contract Title"), {
      target: { value: "Summer covenant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "5 GAS" }));
    fireEvent.click(screen.getByRole("button", { name: "90 Days" }));

    expect(document.querySelector(".breakup-play-area--ready")).toBeTruthy();
    expect(
      document.querySelectorAll(".breakup-pact-lifecycle__step.is-active")
        .length,
    ).toBe(4);
    expect(screen.getAllByText("Summer covenant").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Ready for wallet review.").length,
    ).toBeGreaterThan(0);
  });

  it("keeps disabled and loading create CTAs visually distinct", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../breakup-contract/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toMatch(
      /\.breakup-create-cta\.neo-btn--primary\.neo-btn--loading\s*\{[\s\S]*color:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.breakup-play-area \.breakup-create-cta\.is-ready\.neo-btn--primary\s*\{[\s\S]*background-color:\s*#0b5e3e !important/,
    );
    expect(styles).toMatch(
      /\.breakup-create-cta\.neo-btn--primary:disabled:not\(\.neo-btn--loading\)/,
    );
    expect(styles).toMatch(/background:\s*\$pact-green-soft/);
    expect(styles).toMatch(/color:\s*var\(--ns-brand-deep/);
    expect(styles).toContain(".breakup-pact-tabletop");
    expect(styles).toContain(".breakup-pact-lifecycle");
    expect(styles).toContain("@keyframes breakup-table-drift");
    expect(styles).toContain("@keyframes breakup-seal-ready");
    expect(styles).toContain("@keyframes breakup-step-sheen");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.breakup-pact-lifecycle__step\.is-active::after/,
    );
  });

  it("renders actionable contract cards for the current party", () => {
    const dispatch = vi.fn();
    render(
      <PlayArea
        t={t}
        state={state({
          contracts: [
            {
              id: 7,
              party1: OTHER,
              party2: PARTNER,
              // The connected wallet is the named partner (party2): only they can
              // sign a pending pact. isCreator/isPartner are resolved by the
              // composable (via ownerMatchesAddress) and consumed by ContractList.
              isCreator: false,
              isPartner: true,
              partner: OTHER,
              title: "Summer covenant",
              terms: "Shared expectations.",
              stake: 5,
              stakeRaw: "500000000",
              progress: 0,
              daysLeft: 90,
              status: "pending",
              party1Signed: true,
              party2Signed: false,
            },
          ],
          contractCount: 1,
          pendingCount: 1,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Contract" }));

    expect(screen.getByText("Summer covenant")).toBeTruthy();
    expect(screen.getAllByText("5 GAS").length).toBeGreaterThan(0);
    expect(dispatch).toHaveBeenCalledWith(
      "signContract",
      expect.objectContaining({ id: 7 }),
    );
  });
});
