import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OperationPanel } from "../../components/OperationPanel";

describe("OperationPanel", () => {
  const operations = [
    {
      name: "Stake NEO",
      method: "stake",
      button_style: "success" as const,
      params: [
        {
          name: "amount",
          label: "Stake amount",
          type: "amount" as const,
          default_value: "10",
        },
      ],
    },
    {
      name: "Vote Best Candidate",
      method: "voteBestCandidate",
      params: [
        {
          name: "candidate",
          label: "Candidate",
          type: "string" as const,
          default_value: "candidate-a",
        },
      ],
    },
    {
      name: "Withdraw NEO",
      method: "withdraw",
    },
    {
      name: "Withdraw Credit",
      method: "withdrawCredit",
    },
  ];
  const oneGateVaultClaimOperation = {
    name: "Claim Reward",
    method: "claimOneGateVault",
    button_style: "success" as const,
    params: [
      {
        name: "claimKey",
        label: "Claim key",
        type: "string" as const,
        required: true,
        sensitive: true,
      },
      {
        name: "poolId",
        label: "Pool ID",
        type: "string" as const,
      },
      {
        name: "oneGateAppId",
        type: "string" as const,
        default_value: "23",
        hidden: true,
      },
    ],
  };

  it("keeps long operation labels readable and resets form defaults between tabs", () => {
    render(
      <OperationPanel
        operations={operations}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByTestId("operation-tab-grid")).toHaveClass("flex");
    expect(screen.getByTestId("operation-tab-grid").className).not.toContain(
      "grid-cols",
    );

    fireEvent.change(screen.getByLabelText("Stake amount"), {
      target: { value: "25" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Vote Best Candidate" })[0],
    );

    expect(screen.getByLabelText("Candidate")).toHaveValue("candidate-a");

    fireEvent.click(screen.getAllByRole("button", { name: "Stake NEO" })[0]);

    expect(screen.getByLabelText("Stake amount")).toHaveValue(10);
  });

  it("submits the first select option when a required select has no explicit default", async () => {
    const onInvoke = jest.fn();

    render(
      <OperationPanel
        operations={[
          {
            name: "Flip",
            method: "placeCoinFlipBet",
            params: [
              {
                name: "side",
                label: "Side",
                type: "select" as const,
                required: true,
                options: [
                  { label: "Heads", value: "heads" },
                  { label: "Tails", value: "tails" },
                ],
              },
              {
                name: "amount",
                label: "Wager",
                type: "amount" as const,
                required: true,
              },
            ],
          },
        ]}
        onInvoke={onInvoke}
        showTitle={false}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Side" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Side: Heads" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Wager"), {
      target: { value: "0.01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Flip" }));

    expect(screen.queryByText("Side is required.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "placeCoinFlipBet" }),
        expect.objectContaining({ side: "heads", amount: "0.01" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Flip" })).not.toBeDisabled(),
    );
  });

  it("applies launch params and opens the requested operation tab", async () => {
    const onInvoke = jest.fn();

    render(
      <OperationPanel
        operations={operations}
        onInvoke={onInvoke}
        showTitle={false}
        launchContext={{
          appId: "miniapp-profitanchor",
          source: "onegate",
          operation: "voteBestCandidate",
          tab: null,
          network: "testnet",
          params: {
            amount: "42",
            candidate: "candidate-b",
          },
          keys: ["amount", "candidate"],
          hasParams: true,
          signature: "candidate=candidate-b&amount=42",
        }}
      />,
    );

    expect(screen.getByLabelText("Candidate")).toHaveValue("candidate-b");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Vote Best Candidate" })[1],
    );
    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "voteBestCandidate" }),
        expect.objectContaining({ candidate: "candidate-b" }),
      ),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Stake NEO" })[0]);
    expect(screen.getByLabelText("Stake amount")).toHaveValue(42);
  });

  it("refreshes form values when launch params change under the same route signature", () => {
    const { rerender } = render(
      <OperationPanel
        operations={operations}
        onInvoke={jest.fn()}
        showTitle={false}
        launchContext={{
          appId: "miniapp-profitanchor",
          source: "onegate",
          operation: "stake",
          tab: null,
          network: "testnet",
          params: { amount: "12" },
          keys: ["amount"],
          hasParams: true,
          signature: "stable-onegate-session",
        }}
      />,
    );

    expect(screen.getByLabelText("Stake amount")).toHaveValue(12);

    rerender(
      <OperationPanel
        operations={operations}
        onInvoke={jest.fn()}
        showTitle={false}
        launchContext={{
          appId: "miniapp-profitanchor",
          source: "onegate",
          operation: "stake",
          tab: null,
          network: "testnet",
          params: { amount: "33" },
          keys: ["amount"],
          hasParams: true,
          signature: "stable-onegate-session",
        }}
      />,
    );

    expect(screen.getByLabelText("Stake amount")).toHaveValue(33);
  });

  it("renders market-style controls inside the action box without invented amount shortcuts", () => {
    render(
      <OperationPanel
        operations={[
          {
            name: "Buy Up",
            method: "buyUp",
            params: [
              {
                name: "side",
                label: "Outcome",
                type: "select" as const,
                options: [
                  { label: "Up", value: "up" },
                  { label: "Down", value: "down" },
                ],
              },
              {
                name: "amount",
                label: "Amount",
                type: "amount" as const,
                default_value: "5",
              },
            ],
          },
        ]}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByTestId("operation-panel-shell")).toBeVisible();
    expect(screen.getByRole("radio", { name: "Outcome: Up" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Outcome: Down" })).toBeVisible();
    expect(screen.getByLabelText("Amount")).toHaveValue(5);
    expect(
      screen.queryByRole("button", { name: "25 GAS" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Wallet signed")).not.toBeInTheDocument();
    expect(screen.getByTestId("operation-submit-button")).toBeVisible();
    expect(screen.getByTestId("operation-submit-button")).toHaveClass(
      "sm:w-fit",
    );
  });

  it("renders secondary select params as compact choice controls, not visible dropdown fields", async () => {
    const onInvoke = jest.fn();
    const { container } = render(
      <OperationPanel
        operations={[
          {
            name: "Create Stream",
            method: "createStream",
            params: [
              {
                name: "asset",
                label: "Asset",
                type: "select" as const,
                default_value: "gas",
                options: [
                  { label: "GAS", value: "gas" },
                  { label: "NEO", value: "neo" },
                ],
              },
              {
                name: "amount",
                label: "Amount",
                type: "amount" as const,
                default_value: "5",
              },
              {
                name: "releaseMode",
                label: "Release mode",
                type: "select" as const,
                default_value: "linear",
                options: [
                  { label: "Linear", value: "linear" },
                  { label: "Cliff", value: "cliff" },
                ],
              },
            ],
          },
        ]}
        onInvoke={onInvoke}
        showTitle={false}
      />,
    );

    expect(container.querySelector("select")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Asset" })).toBeVisible();
    expect(
      screen.getByRole("radiogroup", { name: "Release mode" }),
    ).not.toBeVisible();
    expect(screen.getByTestId("operation-param-summary")).toHaveTextContent(
      "Release mode",
    );
    expect(screen.getByTestId("operation-param-summary")).toHaveTextContent(
      "Linear",
    );
    fireEvent.click(screen.getByText("Parameters"));
    expect(
      screen.getByRole("radiogroup", { name: "Release mode" }),
    ).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Asset" })).toHaveClass(
      "flex",
    );
    expect(
      screen.getByRole("radiogroup", { name: "Asset" }).className,
    ).not.toContain("grid-cols");

    fireEvent.click(screen.getByRole("radio", { name: "Release mode: Cliff" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Stream" }));

    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "createStream" }),
        expect.objectContaining({
          amount: "5",
          asset: "gas",
          releaseMode: "cliff",
        }),
      ),
    );
  });

  it("renders boolean params as switch cards instead of raw checkbox fields", async () => {
    const onInvoke = jest.fn();
    const { container } = render(
      <OperationPanel
        operations={[
          {
            name: "Enable Boost",
            method: "enableBoost",
            params: [
              {
                name: "boost",
                label: "Boost mode",
                type: "boolean" as const,
              },
            ],
          },
        ]}
        onInvoke={onInvoke}
        showTitle={false}
      />,
    );

    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    const boostSwitch = screen.getByRole("switch", { name: "Boost mode" });
    expect(boostSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(boostSwitch);
    expect(boostSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Enable Boost" }));

    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "enableBoost" }),
        expect.objectContaining({ boost: "true" }),
      ),
    );
  });

  it("renders amount shortcuts only when the miniapp definition explicitly provides them", () => {
    render(
      <OperationPanel
        operations={[
          {
            name: "Roll",
            method: "placeDiceBet",
            params: [
              {
                name: "amount",
                label: "Stake",
                type: "amount" as const,
                default_value: "0.10",
                presets: [
                  { label: "0.10", value: "0.10", helper: "GAS" },
                  { label: "0.50", value: "0.50", helper: "GAS" },
                  { label: "1.00", value: "1.00", helper: "GAS" },
                ],
              },
            ],
          },
        ]}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByRole("button", { name: "0.10 GAS" })).toBeVisible();
    expect(screen.getByRole("button", { name: "0.50 GAS" })).toBeVisible();
    expect(screen.getByRole("button", { name: "1.00 GAS" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "25 GAS" }),
    ).not.toBeInTheDocument();
  });

  it("keeps generated field ids unique when desktop and mobile action panels coexist", () => {
    const repeatedOperation = [
      {
        name: "Buy Keys",
        method: "buyCountdownKeys",
        params: [
          {
            name: "side",
            label: "Side",
            type: "select" as const,
            options: [
              { label: "Fast", value: "fast" },
              { label: "Safe", value: "safe" },
            ],
          },
          {
            name: "keyCount",
            label: "Keys",
            type: "integer" as const,
            default_value: "3",
          },
          {
            name: "memo",
            label: "Memo",
            type: "string" as const,
            default_value: "round-ready",
          },
        ],
      },
    ];

    const { container } = render(
      <>
        <OperationPanel
          operations={repeatedOperation}
          onInvoke={jest.fn()}
          showTitle={false}
        />
        <OperationPanel
          operations={repeatedOperation}
          onInvoke={jest.fn()}
          showTitle={false}
        />
      </>,
    );

    const fieldIds = Array.from(
      container.querySelectorAll("input[id], textarea[id], [role='radiogroup'][aria-labelledby]"),
      (element) => element.id || element.getAttribute("aria-labelledby"),
    );

    expect(fieldIds).toHaveLength(new Set(fieldIds).size);
    expect(screen.getAllByLabelText("Keys")).toHaveLength(2);
    expect(screen.getAllByLabelText("Memo")).toHaveLength(2);
    expect(screen.getAllByRole("radiogroup", { name: "Side" })).toHaveLength(2);
  });

  it("lets users paste OneGate Vault claim keys and clears sensitive values after submit", async () => {
    const onInvoke = jest.fn().mockResolvedValue(undefined);

    render(
      <OperationPanel
        operations={[oneGateVaultClaimOperation]}
        onInvoke={onInvoke}
        showTitle={false}
        launchContext={{
          appId: "miniapp-gas-lucky-pool",
          source: "url",
          operation: null,
          tab: null,
          network: "testnet",
          params: {},
          keys: [],
          hasParams: false,
          signature: "",
        }}
      />,
    );

    expect(screen.getByText("Paste claim key or scan QR")).toBeVisible();
    expect(screen.getByLabelText("Claim key")).toBeVisible();
    expect(screen.getByLabelText("Pool ID")).toBeVisible();
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claim Reward" }),
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));
    expect(screen.getByText("Claim key is required.")).toBeVisible();
    expect(onInvoke).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Claim key"), {
      target: { value: "ogv_campaign_a_user_42" },
    });
    fireEvent.change(screen.getByLabelText("Pool ID"), {
      target: { value: "pool-042" },
    });

    expect(screen.getByText("Reward ready")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));

    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "claimOneGateVault" }),
        expect.objectContaining({
          claimKey: "ogv_campaign_a_user_42",
          oneGateAppId: "23",
          poolId: "pool-042",
        }),
      ),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Claim key")).toHaveValue(""),
    );
  });

  it("prefills OneGate Vault QR aliases in the primary claim action", async () => {
    const onInvoke = jest.fn().mockResolvedValue(undefined);
    render(
      <OperationPanel
        operations={[oneGateVaultClaimOperation]}
        onInvoke={onInvoke}
        showTitle={false}
        launchContext={{
          appId: "miniapp-gas-lucky-pool",
          source: "onegate",
          operation: "claimOneGateVault",
          tab: null,
          network: "testnet",
          params: { key: "ogv_alias_key", pool: "launch-pool" },
          keys: ["key", "pool"],
          hasParams: true,
          signature: "key=ogv_alias_key&pool=launch-pool",
        }}
      />,
    );

    expect(screen.getByText("Reward ready")).toBeVisible();
    expect(screen.getByLabelText("Claim key")).toHaveValue("ogv_alias_key");
    expect(screen.getByLabelText("Pool ID")).toHaveValue("launch-pool");
    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));

    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "claimOneGateVault" }),
        expect.objectContaining({
          claimKey: "ogv_alias_key",
          oneGateAppId: "23",
          poolId: "launch-pool",
        }),
      ),
    );
  });

  it("folds secondary and operator operations away from the primary action tabs", () => {
    render(
      <OperationPanel
        operations={[
          {
            name: "Claim",
            method: "claimEnvelope",
            priority: "primary" as const,
            params: [],
          },
          {
            name: "Create",
            method: "createEnvelope",
            priority: "secondary" as const,
            button_style: "secondary" as const,
            params: [],
          },
          {
            name: "Move NEO",
            method: "transferAgentNeo",
            priority: "operator" as const,
            button_style: "secondary" as const,
            params: [],
          },
        ]}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByTestId("operation-tab-grid")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Claim" })[0]).toBeVisible();

    fireEvent.click(screen.getByText("More actions"));
    expect(screen.getByRole("button", { name: "Create" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Move NEO" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByTestId("operation-submit-button")).toHaveTextContent(
      "Create",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Claim" })[0]);
    expect(screen.getByTestId("operation-submit-button")).toHaveTextContent(
      "Claim",
    );
  });

  it("labels workspace-preview operations as opening the workspace, not submitting business tx", () => {
    render(
      <OperationPanel
        operations={[
          {
            name: "Create listing",
            method: "prepareMiniAppOperation",
            params: [],
          },
        ]}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByTestId("operation-submit-button")).toHaveTextContent(
      "Open workspace",
    );
    expect(
      screen.queryByRole("button", { name: "Create listing" }),
    ).not.toBeInTheDocument();
  });

  it("can defer submit failures to an external feedback surface", async () => {
    const onInvoke = jest.fn().mockRejectedValue(new Error("Backend exploded"));

    render(
      <OperationPanel
        operations={[
          {
            name: "Check Sponsorship",
            method: "checkSponsor",
            params: [
              {
                name: "aaAddress",
                label: "AA Address",
                type: "address" as const,
                required: true,
              },
            ],
          },
        ]}
        onInvoke={onInvoke}
        showTitle={false}
        showInvokeError={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check Sponsorship" }));
    expect(screen.getByText("AA Address is required.")).toBeVisible();

    fireEvent.change(screen.getByLabelText("AA Address"), {
      target: { value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check Sponsorship" }));

    await waitFor(() => expect(onInvoke).toHaveBeenCalled());
    expect(screen.queryByText("Backend exploded")).not.toBeInTheDocument();
  });
});
