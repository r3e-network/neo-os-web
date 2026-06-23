import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MiniAppOperationPanel } from "../components/MiniAppOperationPanel";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const labels: Record<string, string> = {
    fundPool: "Fund Pool",
    fundAction: "Fund",
    amount: "Amount",
    fieldInvalidFormat: "Invalid format",
    fieldRequired: "Required",
  };
  return labels[key] ?? key;
}

const fundOperation = {
  key: "fundPool",
  titleKey: "fundPool",
  actionKey: "fundAction",
  actionMethod: "fundPool",
  fields: [
    {
      key: "amount",
      type: "amount" as const,
      labelKey: "amount",
      required: true,
      default: "1",
    },
  ],
};

describe("MiniAppOperationPanel amount scaling", () => {
  it("scales amount fields to Fixed8 strings without losing large-value precision", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);

    render(
      <MiniAppOperationPanel
        operations={[fundOperation]}
        t={t}
        state={{}}
        onAction={onAction}
        scaleAmounts
      />,
    );

    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "1000000000.00000001");
    await userEvent.click(screen.getByRole("button", { name: "Fund" }));

    await waitFor(() => {
      expect(onAction).toHaveBeenCalledWith("fundPool", {
        amount: "100000000000000001",
      });
    });
  });

  it("rejects over-precision scaled amounts before dispatching the action", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);

    render(
      <MiniAppOperationPanel
        operations={[fundOperation]}
        t={t}
        state={{}}
        onAction={onAction}
        scaleAmounts
      />,
    );

    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "1.000000001");
    await userEvent.click(screen.getByRole("button", { name: "Fund" }));

    expect(onAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Invalid format")).toBeTruthy();
  });
});
