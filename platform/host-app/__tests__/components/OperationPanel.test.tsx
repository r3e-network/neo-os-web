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

    const firstTab = screen.getAllByRole("button", { name: "Stake NEO" })[0];
    expect(firstTab.parentElement).toHaveClass("grid-cols-2");

    fireEvent.change(screen.getByLabelText("Stake amount"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Vote Best Candidate" })[0]);

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
    await waitFor(() => expect(screen.getByRole("button", { name: "Flip" })).not.toBeDisabled());
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

    fireEvent.click(screen.getAllByRole("button", { name: "Vote Best Candidate" })[1]);
    await waitFor(() =>
      expect(onInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ method: "voteBestCandidate" }),
        expect.objectContaining({ candidate: "candidate-b" }),
      ),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Stake NEO" })[0]);
    expect(screen.getByLabelText("Stake amount")).toHaveValue(42);
  });
});
