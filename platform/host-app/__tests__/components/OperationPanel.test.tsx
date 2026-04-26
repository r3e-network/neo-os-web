import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
          type: "text" as const,
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
    fireEvent.click(screen.getByRole("button", { name: "Vote Best Candidate" }));

    expect(screen.getByLabelText("Candidate")).toHaveValue("candidate-a");

    fireEvent.click(screen.getAllByRole("button", { name: "Stake NEO" })[0]);

    expect(screen.getByLabelText("Stake amount")).toHaveValue(10);
  });
});
