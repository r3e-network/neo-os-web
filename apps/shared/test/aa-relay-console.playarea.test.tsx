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
import PlayArea from "../../aa-relay-console/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const AA_ADDRESS = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";

function t(key: string) {
  const messages: Record<string, string> = {
    relayHeroTitle: "Sponsored relay desk",
    relayHeroCopy: "Check sponsorship and submit payloads.",
    relayStageKicker: "Paymaster relay",
    relayStageTitle: "Sponsor GAS, validate payload, then relay.",
    relayMetricsLabel: "Relay environment summary",
    network: "Network",
    relayEndpointMetric: "Relay Endpoint",
    paymasterLabel: "Paymaster",
    relayCommandTitle: "Sponsor Preflight",
    aaCoreLabel: "AA Core",
    aaAddress: "AA Address",
    aaAddressHint: "Required before sponsorship checks.",
    aaAddressPlaceholder: "N...",
    sponsorCheck: "Check Sponsorship",
    sponsorRequest: "Request Sponsorship",
    sponsorBlocked: "Enter an AA address before checking sponsorship.",
    relayFlowLabel: "AA relay workflow",
    relayFlowSponsor: "Check sponsorship",
    relayFlowSponsorDesc: "Resolve paymaster coverage.",
    relayFlowRequest: "Request paymaster",
    relayFlowRequestDesc: "Ask for sponsorship.",
    relayFlowSubmit: "Submit relay",
    relayFlowSubmitDesc: "Send validated JSON.",
    relayStateLabel: "Relay Runtime",
    relayStateTitle: "Sponsorship state",
    labelAA: "AA",
    labelSponsor: "Sponsor",
    relayLabel: "Relay",
    relayRiskTitle: "Submission guardrails",
    relayRiskCopy: "Blocks empty AA addresses and invalid JSON.",
    relaySubmitTitle: "Relay Payload",
    relayDraftLabel: "Draft AA",
    relayBlocked: "Enter an AA address and keep the payload JSON valid.",
    payloadInvalid: "Fix the JSON payload before submitting.",
    relayPayloadLens: "Payload lens",
    relayPayloadReady: "Relay payload is readable",
    relayPayloadOperation: "Operation",
    relayPayloadTarget: "Target",
    relayPayloadArgs: "Args",
    dappId: "Paymaster Dapp ID",
    dappIdHint: "Optional paymaster scope.",
    dappIdPlaceholder: "Optional dapp id",
    sponsorAmount: "Sponsor Amount",
    sponsorAmountHint: "GAS amount requested from the paymaster.",
    sponsorAmountPlaceholder: "0.1",
    payloadJson: "Relay Payload JSON",
    payloadJsonHint: "Must be valid JSON.",
    payloadJsonPlaceholder: "{}",
    submitRelay: "Submit Relay Payload",
    notAvailable: "Not available",
    unset: "unset",
    sponsorCheckComplete: "Sponsor check complete.",
    sponsorEligible: "Eligible for sponsorship.",
    serviceUnavailable: "Sponsorship service is currently unavailable.",
    latestRelay: "Latest Relay Response",
    aaAddressInvalid: "Enter a valid Neo address or 0x script hash.",
  };
  let value = messages[key] ?? key;
  return value;
}

function tParams(
  key: string,
  params?: Record<string, string | number>,
): string {
  const base = t(key);
  if (key === "sponsorEligibleSummary") {
    return `Eligible — ${params?.remaining} GAS of ${params?.dailyLimit} remaining today.`;
  }
  return base;
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-aa-relay-console");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    aaAddressDisplay: "Not available",
    paymasterDisplay: "unset",
    sponsorState: "{}",
    relayResponse: "{}",
    aaCoreDisplay: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
    relayUrlDisplay: "/api/aa/relay",
    networkDisplay: "testnet",
    isCheckingSponsorship: false,
    isRelaying: false,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("AA Relay Console PlayArea", () => {
  it("prefills scoped relay fields from host launch params and dispatches them", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const payload = '{"metaInvocation":{"operation":"transfer"}}';

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-relay-console?network=testnet&aaAddress=${AA_ADDRESS}&dappId=miniapp-aa-relay-console&sponsorAmount=0.2&payloadJson=${encodeURIComponent(payload)}`,
        )}
      />,
    );

    expect((screen.getByLabelText("AA Address") as HTMLInputElement).value).toBe(
      AA_ADDRESS,
    );
    expect(
      (screen.getByLabelText("Paymaster Dapp ID") as HTMLInputElement).value,
    ).toBe("miniapp-aa-relay-console");
    expect(
      (screen.getByLabelText("Sponsor Amount") as HTMLInputElement).value,
    ).toBe("0.2");
    expect(
      (screen.getByLabelText("Relay Payload JSON") as HTMLTextAreaElement)
        .value,
    ).toBe(payload);
    expect(document.querySelector('.relay-hero__stage img[src="./aa-relay-station.jpg"]')).toBeTruthy();
    expect(screen.getByLabelText("AA relay workflow")).toBeTruthy();
    expect(screen.getByLabelText("Payload lens")).toBeTruthy();
    expect(screen.getByText("transfer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Check Sponsorship" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "checkSponsor",
        AA_ADDRESS,
        "miniapp-aa-relay-console",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Request Sponsorship" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "requestSponsor",
        AA_ADDRESS,
        "miniapp-aa-relay-console",
        "0.2",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Relay Payload" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "submitRelay",
        AA_ADDRESS,
        "miniapp-aa-relay-console",
        payload,
      );
    });
  });

  it("blocks relay submission until the AA address and JSON payload are valid", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-relay-console?payloadJson=%7Bbad",
        )}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Check Sponsorship" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Submit Relay Payload" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getAllByText("Fix the JSON payload before submitting.").length).toBeGreaterThanOrEqual(1);
  });

  it("promotes the eligibility answer to the result headline", () => {
    render(
      <PlayArea
        t={tParams}
        state={baseState({
          sponsorState: JSON.stringify({
            eligible: true,
            remaining: "4",
            dailyLimit: "10",
          }),
        })}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-relay-console?aaAddress=${AA_ADDRESS}`,
        )}
      />,
    );
    expect(
      screen.getByText("Eligible — 4 GAS of 10 remaining today."),
    ).toBeTruthy();
  });

  it("maps a host service-outage error to an honest unavailable message", () => {
    render(
      <PlayArea
        t={tParams}
        state={baseState({
          sponsorState: JSON.stringify({
            error: { code: "FORBIDDEN", message: "function not allowed" },
          }),
        })}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-relay-console?aaAddress=${AA_ADDRESS}`,
        )}
      />,
    );
    // The headline reads as a localized "unavailable" sentence; the raw body
    // still lives in the collapsed <details> for debugging.
    const headline = document.querySelector(".relay-result__text");
    expect(headline?.textContent).toBe(
      "Sponsorship service is currently unavailable.",
    );
  });

  it("flags an invalid AA address inline", () => {
    render(
      <PlayArea
        t={tParams}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-relay-console?aaAddress=abc",
        )}
      />,
    );
    expect(
      screen.getByText("Enter a valid Neo address or 0x script hash."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Check Sponsorship" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
