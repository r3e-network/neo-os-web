import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

    expect(document.querySelector("select")).toBeNull();
    expect(
      screen.getByRole("radio", { name: "Face: 6" }).getAttribute("aria-checked"),
    ).toBe("true");

    await userEvent.click(screen.getByRole("radio", { name: "Face: 3" }));
    expect(selectedFace.get()).toBe("3");
    expect(
      screen.getByRole("radio", { name: "Face: 3" }).getAttribute("aria-checked"),
    ).toBe("true");

    const amountInput = screen.getByLabelText("Stake");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "2.5");

    expect(stakeAmount.get()).toBe("2.50 GAS");
    expect(payoutPreview.get()).toBe("14.25 GAS");
  });

  it("renders toggle params as switch cards without native checkbox controls", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);

    render(
      <MiniAppOperationPanel
        operations={[
          {
            key: "enableGameMode",
            titleKey: "gameMode",
            actionKey: "saveMode",
            actionMethod: "enableGameMode",
            fields: [
              {
                key: "turbo",
                type: "toggle",
                labelKey: "turboMode",
                default: false,
              },
            ],
          },
        ]}
        t={(key) =>
          ({
            gameMode: "Game mode",
            saveMode: "Save mode",
            turboMode: "Turbo mode",
          })[key] ?? key
        }
        state={{}}
        onAction={onAction}
      />,
    );

    expect(document.querySelector('input[type="checkbox"]')).toBeNull();

    const turboSwitch = screen.getByRole("switch", { name: "Turbo mode" });
    expect(turboSwitch.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(turboSwitch);
    expect(turboSwitch.getAttribute("aria-checked")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "Save mode" }));
    expect(onAction).toHaveBeenCalledWith("enableGameMode", { turbo: true });
  });

  it("keeps operation choice controls compact and reduced-motion safe", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../shared/components/MiniAppOperationPanel.scss"),
      "utf8",
    );
    const choiceOptionsBlock = styles.match(/\.field-choice__options\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const choiceButtonBlock = styles.match(/\.field-choice__button\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const operationCardBlock = styles.match(/\.operation-card\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const operationActionBlock = styles.match(/\.operation-action-btn\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const disabledActionStart = styles.indexOf("  &:disabled {", styles.indexOf(".operation-action-btn"));
    const disabledActionEnd = styles.indexOf("\n  }\n}", disabledActionStart);
    const disabledActionBlock = styles.slice(disabledActionStart, disabledActionEnd);
    const reducedMotion = styles.slice(
      styles.indexOf("@media (prefers-reduced-motion: reduce)"),
    );

    expect(styles).toContain(".field-choice__button");
    expect(styles).toContain(".field-choice__button--active");
    expect(styles).toContain(".toggle-label--checked");
    expect(choiceOptionsBlock).toContain("display: flex");
    expect(choiceOptionsBlock).toContain("width: fit-content");
    expect(choiceOptionsBlock).not.toContain("grid-template-columns");
    expect(choiceButtonBlock).toContain("min-height: 30px");
    expect(choiceButtonBlock).not.toContain("min-height: 42px");
    expect(operationCardBlock).toContain("border-radius: 8px");
    expect(operationActionBlock).toContain("width: fit-content");
    expect(operationActionBlock).not.toContain("min-width: 100%");
    expect(operationActionBlock).not.toContain("background: #111827");
    expect(styles).not.toMatch(/font-weight:\\s*(750|800|850|900)/);
    expect(disabledActionBlock).toContain("cursor: not-allowed");
    expect(styles).toContain(".operation-action-btn.neo-btn--loading:disabled");
    expect(styles).toContain("cursor: progress");
    expect(styles).not.toContain(".neo-select");
    expect(styles).not.toContain(".toggle-input");
    expect(reducedMotion).toContain(".field-choice__button:hover");
    expect(reducedMotion).toContain(".toggle-switch::after");
    expect(reducedMotion).toContain(".operation-secondary summary svg");
    expect(reducedMotion).toContain("transform: none");
  });
});
