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
import PlayArea from "../../aa-session-key-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const SESSION_PUBLIC_KEY = `02${"11".repeat(32)}`;
const TARGET_CONTRACT = "0xaba84da240a55410d284a656fc8dae044e6ec1a5";
const EXPIRES_AT = "1893456000";

function t(key: string) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
    notConnected: "not connected",
    pending: "pending",
    idle: "idle",
    anyMethod: "Any method",
    sessionKeyReady: "ready",
    sessionKeyMissing: "missing",
    sessionHeroTitle: "Scoped session keys for safer AA actions",
    sessionHeroCopy: "Generate and bind scoped session keys.",
    sessionMetricsLabel: "Session key readiness",
    sessionMetricStatus: "Session",
    sessionMetricSponsor: "Sponsor",
    sessionMetricScope: "Scope",
    sessionCommandTitle: "Key & sponsorship",
    wallet: "Wallet",
    sessionPublicKey: "Session Public Key",
    sessionPublicKeyPlaceholder: "33-byte compressed public key",
    privateKeyReady: "Ready for one-time copy",
    copyPrivateKey: "Copy Private Key",
    copiedPrivateKey: "Copied",
    showPrivateKey: "Show",
    hidePrivateKey: "Hide",
    copyPrivateKeyFailed: "Copy failed — select and copy the key manually.",
    sessionPrivateKey: "Session Private Key",
    dappId: "Paymaster dApp ID",
    dappIdPlaceholder: "miniapp-aa-session-key-lab",
    sponsorAmount: "Sponsor Amount",
    sponsorAmountPlaceholder: "0.1",
    invalidSponsorAmount: "Sponsor amount must be a positive number.",
    generateKey: "Generate Key",
    checkSponsor: "Check Sponsorship",
    requestSponsor: "Request Sponsorship",
    sessionFlowLabel: "Session setup workflow",
    sessionFlowKey: "Generate key",
    sessionFlowKeyDesc: "Create a browser-local key.",
    sessionFlowSponsor: "Check sponsor",
    sessionFlowSponsorDesc: "Confirm sponsorship.",
    sessionFlowConfigure: "Configure scope",
    sessionFlowConfigureDesc: "Submit after fields are present.",
    sessionStateLabel: "Live state",
    latestState: "Latest Configuration",
    aaCore: "AA Core",
    sessionVerifier: "Session Verifier",
    derivedAccountId: "Account ID Hash",
    normalizedTarget: "Target Contract",
    normalizedMethod: "Allowed Method",
    noDetails: "No details",
    sessionEmptyCopy: "Generate a key or submit a configuration.",
    configureSession: "Configure Session Key",
    sessionScopeTitle: "Target scope",
    configureSessionBlocked:
      "Add an account ID/hash, session public key, target contract, and expiry before submitting.",
    accountSeed: "Account ID / Hash",
    accountSeedPlaceholder: "seed string or 0x hash",
    targetContract: "Target Contract",
    targetContractPlaceholder: "0x... or N...",
    allowedMethod: "Allowed Method",
    allowedMethodPlaceholder: "symbol",
    expiresAt: "Expiry Timestamp",
    expiresAtPlaceholder: "unix seconds",
  };
  return messages[key] ?? key;
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-aa-session-key-lab");
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    isSubmitting: false,
    isCheckingSponsorship: false,
    detailItems: [],
    derivedAccountIdHash: "",
    normalizedTargetContract: "",
    normalizedAllowedMethod: "",
    aaCoreDisplay: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
    sessionStatusDisplay: "pending",
    sessionVerifierDisplay: "0xed44c88535650b4dd6b8d59776e6ed045462cab6",
    walletDisplay: "not connected",
    sponsorStatusDisplay: "idle",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("AA Session Key Lab PlayArea launch flow", () => {
  it("prefills session key forms from host launch params and dispatches real fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-session-key-lab?network=testnet&accountSeed=neo-aa-001&sessionPublicKey=${SESSION_PUBLIC_KEY}&targetContract=${TARGET_CONTRACT}&allowedMethod=claimRewards&expiresAt=${EXPIRES_AT}&dappId=miniapp-aa-session-key-lab&sponsorAmount=0.2`,
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Account ID / Hash") as HTMLInputElement).value,
    ).toBe("neo-aa-001");
    expect(
      (screen.getByLabelText("Session Public Key") as HTMLInputElement).value,
    ).toBe(SESSION_PUBLIC_KEY);
    expect(
      (screen.getByLabelText("Target Contract") as HTMLInputElement).value,
    ).toBe(TARGET_CONTRACT);
    expect(
      (screen.getByLabelText("Allowed Method") as HTMLInputElement).value,
    ).toBe("claimRewards");
    expect(
      (screen.getByLabelText("Expiry Timestamp") as HTMLInputElement).value,
    ).toBe(EXPIRES_AT);
    expect(
      (screen.getByLabelText("Paymaster dApp ID") as HTMLInputElement).value,
    ).toBe("miniapp-aa-session-key-lab");
    expect(
      (screen.getByLabelText("Sponsor Amount") as HTMLInputElement).value,
    ).toBe("0.2");

    fireEvent.click(screen.getByRole("button", { name: "Check Sponsorship" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Request Sponsorship" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Configure Session Key" }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "checkSponsor",
        "neo-aa-001",
        "miniapp-aa-session-key-lab",
      );
      expect(dispatch).toHaveBeenCalledWith(
        "requestSponsor",
        "neo-aa-001",
        "miniapp-aa-session-key-lab",
        "0.2",
      );
      // Configure now forwards spendingLimit + description too (mainnet needs
      // them; testnet ignores the extras). Defaults: "0" limit, "" description.
      expect(dispatch).toHaveBeenCalledWith(
        "configureSessionKey",
        "neo-aa-001",
        SESSION_PUBLIC_KEY,
        TARGET_CONTRACT,
        "claimRewards",
        EXPIRES_AT,
        "0",
        "",
      );
    });
  });

  it("refreshes visible fields when launch params change in the same mount", () => {
    const nextKey = `03${"22".repeat(32)}`;
    const { rerender } = render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-session-key-lab?accountSeed=neo-aa-001&sessionPublicKey=${SESSION_PUBLIC_KEY}`,
        )}
      />,
    );

    rerender(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-session-key-lab?accountSeed=neo-aa-002&sessionPublicKey=${nextKey}&allowedMethod=transfer`,
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Account ID / Hash") as HTMLInputElement).value,
    ).toBe("neo-aa-002");
    expect(
      (screen.getByLabelText("Session Public Key") as HTMLInputElement).value,
    ).toBe(nextKey);
    expect(
      (screen.getByLabelText("Allowed Method") as HTMLInputElement).value,
    ).toBe("transfer");
  });

  it("masks the generated private key until the user reveals it", async () => {
    const privateKey = `0x${"ab".repeat(32)}`;
    const dispatch = vi.fn().mockResolvedValue({
      publicKey: SESSION_PUBLIC_KEY,
      privateKey,
    });

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-session-key-lab?accountSeed=neo-aa-001",
        )}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));

    expect(await screen.findByText("Ready for one-time copy")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Copy Private Key" }),
    ).toBeTruthy();
    // Full key is masked by default so the user can verify a fingerprint
    // without exposing the whole secret.
    expect(screen.queryByText(privateKey)).toBeNull();
    expect(screen.getByLabelText("Session Private Key").textContent).toContain(
      "…",
    );

    // Toggle reveal exposes the full key so the user can verify what they copy.
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByLabelText("Session Private Key").textContent).toBe(
      privateKey,
    );
  });

  it("surfaces a copy failure when the clipboard API is unavailable", async () => {
    const privateKey = `0x${"cd".repeat(32)}`;
    const dispatch = vi.fn().mockResolvedValue({
      publicKey: SESSION_PUBLIC_KEY,
      privateKey,
    });
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    try {
      render(
        <PlayArea
          t={t}
          state={baseState()}
          dispatch={dispatch}
          launchContext={launch(
            "https://neomini.app/miniapps/aa-session-key-lab?accountSeed=neo-aa-001",
          )}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));
      await screen.findByText("Ready for one-time copy");

      fireEvent.click(screen.getByRole("button", { name: "Copy Private Key" }));

      // Button must NOT flip to "Copied"; instead a real failure is surfaced
      // and the full key is revealed for manual copy.
      expect(screen.queryByText("Copied")).toBeNull();
      expect(
        await screen.findByText(
          "Copy failed — select and copy the key manually.",
        ),
      ).toBeTruthy();
      expect(screen.getByLabelText("Session Private Key").textContent).toBe(
        privateKey,
      );
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it("blocks sponsor requests for empty, zero, or negative amounts", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-session-key-lab?accountSeed=neo-aa-001&sponsorAmount=0",
        )}
      />,
    );

    const requestButton = screen.getByRole("button", {
      name: "Request Sponsorship",
    }) as HTMLButtonElement;

    // "0" is invalid -> button disabled, validation error shown, no dispatch.
    expect(requestButton.disabled).toBe(true);
    expect(
      screen.getByText("Sponsor amount must be a positive number."),
    ).toBeTruthy();
    fireEvent.click(requestButton);
    expect(dispatch).not.toHaveBeenCalledWith(
      "requestSponsor",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );

    // A positive amount re-enables the request flow.
    fireEvent.change(screen.getByLabelText("Sponsor Amount"), {
      target: { value: "0.2" },
    });
    expect(requestButton.disabled).toBe(false);
    fireEvent.click(requestButton);
    expect(dispatch).toHaveBeenCalledWith(
      "requestSponsor",
      "neo-aa-001",
      expect.any(String),
      "0.2",
    );
  });
});
