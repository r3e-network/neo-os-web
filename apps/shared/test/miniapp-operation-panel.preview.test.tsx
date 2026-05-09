import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MiniAppOperationPanel } from "../components/MiniAppOperationPanel";
import { createObservable } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const labels: Record<string, string> = {
    rollDice: "Roll Dice",
    rollDescription: "Choose a face and stake GAS.",
    rollAction: "Roll with VRF",
    selectedFace: "Face",
    stakeAmount: "Stake",
    fieldRequired: "Required",
  };
  return labels[key] ?? key;
}

describe("MiniAppOperationPanel preview state", () => {
  it("keeps Dice playarea preview in sync with action fields", async () => {
    const selectedFace = createObservable("6");
    const stakeAmount = createObservable("0.10 GAS");
    const payoutPreview = createObservable("0.57 GAS");

    render(
      <MiniAppOperationPanel
        operations={[
          {
            key: "placeDiceBet",
            titleKey: "rollDice",
            descriptionKey: "rollDescription",
            actionKey: "rollAction",
            actionMethod: "placeDiceBet",
            fields: [
              {
                key: "chosenNumber",
                type: "select",
                labelKey: "selectedFace",
                required: true,
                default: "6",
                options: [
                  { value: "1", label: "1" },
                  { value: "3", label: "3" },
                  { value: "6", label: "6" },
                ],
              },
              {
                key: "amount",
                type: "amount",
                labelKey: "stakeAmount",
                required: true,
                default: "0.10",
              },
            ],
          },
        ]}
        t={t}
        state={{ selectedFace, stakeAmount, payoutPreview }}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Face"), "3");
    expect(selectedFace.get()).toBe("3");

    const amountInput = screen.getByLabelText("Stake");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "2.5");

    expect(stakeAmount.get()).toBe("2.50 GAS");
    expect(payoutPreview.get()).toBe("14.25 GAS");
  });
});
