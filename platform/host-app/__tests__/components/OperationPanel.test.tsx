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

  it("keeps long operation labels readable and resets form defaults between tabs", () => {
    render(
      <OperationPanel
        operations={operations}
        onInvoke={jest.fn()}
        showTitle={false}
      />,
    );

    expect(screen.getByTestId("operation-tab-grid")).toHaveClass("grid-cols-2");

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

    expect(screen.getByLabelText("Side")).toHaveValue("heads");
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

  it("renders market-style controls inside the action box", () => {
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
    expect(screen.getByRole("button", { name: "Up" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Down" })).toBeVisible();
    expect(screen.getByLabelText("Amount")).toHaveValue(5);
    expect(screen.getByRole("button", { name: "25 GAS" })).toBeVisible();
    expect(screen.queryByText("Wallet signed")).not.toBeInTheDocument();
    expect(screen.getByTestId("operation-submit-button")).toBeVisible();
  });

  it("treats OneGate Vault claim keys as QR context instead of editable amount controls", async () => {
    const onInvoke = jest.fn();
    const claimOperation = {
      name: "Claim Reward",
      method: "claimOneGateVault",
      button_style: "success" as const,
      params: [
        {
          name: "claimKey",
          label: "Claim key",
          type: "string" as const,
          required: true,
        },
      ],
    };

    const { rerender } = render(
      <OperationPanel
        operations={[claimOperation]}
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

    expect(screen.getByText("OneGate QR required")).toBeVisible();
    expect(screen.queryByLabelText("Claim key")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Reward" })).toBeDisabled();

    rerender(
      <OperationPanel
        operations={[claimOperation]}
        onInvoke={onInvoke}
        showTitle={false}
        launchContext={{
          appId: "miniapp-gas-lucky-pool",
          source: "onegate",
          operation: "claimOneGateVault",
          tab: null,
          network: "testnet",
          params: { claimKey: "ogv_campaign_a_user_42" },
          keys: ["claimKey"],
          hasParams: true,
          signature: "claimKey=ogv_campaign_a_user_42",
        }}
      />,
    );

    expect(screen.getByText("Reward ready")).toBeVisible();
    expect(screen.queryByLabelText("Claim key")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));

    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "claimOneGateVault" }),
        expect.objectContaining({ claimKey: "ogv_campaign_a_user_42" }),
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

    expect(screen.queryByTestId("operation-tab-grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeVisible();

    fireEvent.click(screen.getByText("Advanced / Operator"));
    expect(screen.getByRole("button", { name: "Create" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Move NEO" })).toBeVisible();
  });
});
