/**
 * MiniAppOperationPanel i18n routing.
 *
 * The panel's chrome (eyebrow, workflow steps, empty state, "Selected action",
 * "Configure"/"Ready", "No extra fields", and the submitting button label)
 * must render through the translation function rather than hardcoded English,
 * so the en/zh base-messages drive the copy.
 */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MiniAppOperationPanel } from "../components/MiniAppOperationPanel";
import { baseMessages as BASE_MESSAGES } from "../locale/base-messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function makeT(lang: "en" | "zh") {
  return (key: string, params?: Record<string, string | number>) => {
    const entry = (BASE_MESSAGES as Record<string, { en: string; zh: string }>)[
      key
    ];
    let text = entry ? entry[lang] : key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
      }
    }
    return text;
  };
}

describe("MiniAppOperationPanel i18n routing", () => {
  it("renders panel chrome and empty state through base-messages (en)", () => {
    render(
      <MiniAppOperationPanel operations={[]} t={makeT("en")} state={{}} />,
    );

    expect(screen.getByText(BASE_MESSAGES.operationsPanelEyebrow.en)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationsPanelTitle.en)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationWorkflowConfigure.en)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationWorkflowPreview.en)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationWorkflowSubmit.en)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationEmptyTitle.en)).toBeTruthy();
    expect(
      screen.getByText(BASE_MESSAGES.operationEmptyDescription.en),
    ).toBeTruthy();
  });

  it("renders panel chrome through base-messages (zh)", () => {
    render(
      <MiniAppOperationPanel operations={[]} t={makeT("zh")} state={{}} />,
    );

    expect(screen.getByText(BASE_MESSAGES.operationsPanelEyebrow.zh)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationWorkflowConfigure.zh)).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationEmptyTitle.zh)).toBeTruthy();
  });

  it("renders 'Selected action' and the no-extra-fields copy through i18n", () => {
    render(
      <MiniAppOperationPanel
        operations={[
          {
            key: "doThing",
            titleKey: "doThing",
            actionKey: "doThingAction",
            actionMethod: "doThing",
          },
        ]}
        t={makeT("zh")}
        state={{}}
      />,
    );

    expect(
      screen.getByText(BASE_MESSAGES.operationSelectedAction.zh),
    ).toBeTruthy();
    expect(screen.getByText(BASE_MESSAGES.operationReady.zh)).toBeTruthy();
    expect(
      screen.getByText(BASE_MESSAGES.operationNoExtraFields.zh),
    ).toBeTruthy();
  });

  it("falls back to English literals when keys are absent from the locale", () => {
    // An app whose t() does not define the panel keys (returns the key) must
    // still render readable English chrome, not raw key identifiers.
    const t = (key: string) => key;
    render(<MiniAppOperationPanel operations={[]} t={t} state={{}} />);

    expect(screen.getByText("Action")).toBeTruthy();
    expect(screen.getByText("Choose what to do")).toBeTruthy();
    expect(screen.getByText("No transaction action required")).toBeTruthy();
    // The raw key must NOT leak into the UI.
    expect(screen.queryByText("operationsPanelEyebrow")).toBeNull();
  });
});
