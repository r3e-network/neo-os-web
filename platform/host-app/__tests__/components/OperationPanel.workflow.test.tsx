import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { OperationPanel } from "../../components/OperationPanel";
import type { OperationEntry } from "../../components/types";

function activeStep(stage: string) {
  return screen
    .getByTestId(`workflow-step-${stage}`)
    .getAttribute("aria-current");
}

describe("OperationPanel workflow strip", () => {
  it("advances Configure → Preview → Submit → Result with the real form state", async () => {
    let resolveInvoke: () => void = () => undefined;
    const onInvoke = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvoke = resolve;
        }),
    );
    const operations: OperationEntry[] = [
      {
        name: "Stake NEO",
        method: "stakeNeo",
        params: [
          { name: "amount", label: "Amount", type: "integer", required: true },
        ],
      },
    ];

    render(<OperationPanel operations={operations} onInvoke={onInvoke} />);

    // Required param empty → Configure is the current step.
    expect(activeStep("configure")).toBe("step");
    expect(activeStep("preview")).toBeNull();

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "5" },
    });
    expect(activeStep("preview")).toBe("step");

    fireEvent.click(screen.getByTestId("operation-submit-button"));
    await waitFor(() => expect(activeStep("submit")).toBe("step"));

    await act(async () => {
      resolveInvoke();
    });
    await waitFor(() => expect(activeStep("result")).toBe("step"));

    // Editing again walks the workflow back from Result.
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "6" },
    });
    expect(activeStep("preview")).toBe("step");
  });

  it("reaches Result after a failed submit too", async () => {
    const onInvoke = jest.fn().mockRejectedValue(new Error("nope"));
    const operations: OperationEntry[] = [
      { name: "Claim GAS", method: "claimRewards", params: [] },
    ];

    render(<OperationPanel operations={operations} onInvoke={onInvoke} />);

    fireEvent.click(screen.getByTestId("operation-submit-button"));
    await waitFor(() => expect(activeStep("result")).toBe("step"));
    expect(screen.getByText("nope")).toBeInTheDocument();
  });
});

describe("OperationPanel confirm_message", () => {
  const operations: OperationEntry[] = [
    {
      name: "Withdraw Funds",
      method: "withdraw",
      confirm_message: "Withdraw all funds from the escrow?",
      params: [],
    },
  ];

  it("routes manifest confirmations through the shared ConfirmModal, not window.confirm", async () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    const onInvoke = jest.fn().mockResolvedValue(undefined);
    render(<OperationPanel operations={operations} onInvoke={onInvoke} />);

    fireEvent.click(screen.getByTestId("operation-submit-button"));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Withdraw all funds from the escrow?"),
    ).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Withdraw Funds" }),
    );
    await waitFor(() => expect(onInvoke).toHaveBeenCalledTimes(1));
    confirmSpy.mockRestore();
  });

  it("does not invoke when the confirmation is cancelled", async () => {
    const onInvoke = jest.fn().mockResolvedValue(undefined);
    render(<OperationPanel operations={operations} onInvoke={onInvoke} />);

    fireEvent.click(screen.getByTestId("operation-submit-button"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onInvoke).not.toHaveBeenCalled();
  });

  it("uses the danger tone for destructive operations", async () => {
    const onInvoke = jest.fn().mockResolvedValue(undefined);
    render(<OperationPanel operations={operations} onInvoke={onInvoke} />);

    fireEvent.click(screen.getByTestId("operation-submit-button"));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", {
      name: "Withdraw Funds",
    });
    expect(confirmButton.className).toContain("bg-red-500");
  });
});
