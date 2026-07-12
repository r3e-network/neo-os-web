import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../breakup-contract/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const translations: Record<string, string> = {
  active: "Active",
  broken: "Broken",
  builderStepPartner: "Partner and title",
  builderStepStake: "Stake and duration",
  builderStepTerms: "Terms and confirmation",
  builderTitle: "Build pact",
  cancelContract: "Cancel & reclaim",
  contractTermsPlaceholder: "Optional notes",
  contractTitle: "A promise, on-chain",
  contractTitlePlaceholder: "Our covenant",
  contracts: "Contracts",
  createContract: "Create Contract",
  createHintDuration: "Choose duration",
  createHintPartner: "Add partner",
  createHintReady: "Looks good",
  createHintStake: "Set stake",
  createHintTitle: "Add title",
  daysSuffix: "Days",
  docSubtitle: "Breakup",
  duration: "Duration",
  durationLabel: "Contract Duration",
  durationPlaceholder: "Days",
  heroTagStakeBacked: "Stake-backed",
  noContracts: "No contracts yet",
  noContractsHint: "Connect your wallet to load them.",
  pactPreview: "Live pact preview",
  pactPreviewPartner: "Partner address appears here",
  pactPreviewRule: "If the pact is honored, both stakes can be refunded.",
  pactPreviewTerms: "Only stake and duration are enforced on-chain.",
  pactPreviewUntitled: "Untitled pact",
  pactDetails: "Pact details",
  partner: "Partner",
  partnerAddress: "Partner Address",
  partnerPlaceholder: "Enter partner address",
  partnerTermsOffChain: "Only the stake and duration are on-chain.",
  pending: "Pending",
  refreshRecords: "Refresh contracts",
  signContract: "Sign Contract",
  stake: "Stake",
  stakeLabel: "Stake Amount",
  stakePlaceholder: "Amount in GAS",
  termsLabel: "Contract Terms",
  title: "Breakup Contract",
  titleLabel: "Contract Title",
  walletAction: "Wallet action",
};

function t(k: string) { return translations[k] ?? k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    contracts: [],
    address: "",
    contractCount: 0,
    activeCount: 0,
    pendingCount: 0,
    brokenCount: 0,
    isLoading: false,
    hasCredit: false,
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}

describe("breakup-contract integration: dispatch params", () => {
  it("does not dispatch createContract until required fields are complete", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(d).not.toHaveBeenCalled();
  });

  it("dispatches createContract with the reviewed pact parameters", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(".breakup-input--title input.semi-input") as Element, { target: { value: "Mutual Support" } });
    fireEvent.change(container.querySelector(".breakup-input--partner input.semi-input") as Element, { target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" } });
    fireEvent.change(container.querySelector(".breakup-input--stake input.semi-input") as Element, { target: { value: "2.5" } });
    fireEvent.change(container.querySelector(".breakup-input--duration input.semi-input") as Element, { target: { value: "45" } });
    fireEvent.change(container.querySelector(".breakup-input--terms textarea.semi-input-textarea") as Element, { target: { value: "No rage quitting before the trip." } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(d).toHaveBeenCalledWith("createContract", {
      partnerAddress: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
      stakeAmount: "2.5",
      duration: "45",
      title: "Mutual Support",
      terms: "No rage quitting before the trip.",
    });
  });

  it("dispatches signContract from drawer", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText } = render(<PlayArea t={t} state={state({ contracts:[{ id: 1, pactId: "c1", status: "pending", stake: 1, partner: "Npartner", isPartner: true }] })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(getByRole("radio", { name: "Contracts" }));
    fireEvent.click(getByText("Sign Contract"));
    expect(d).toHaveBeenCalledWith("signContract", expect.objectContaining({ pactId:"c1" }));
  });
});
