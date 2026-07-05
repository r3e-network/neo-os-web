import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiSelect, OpenUiTextArea, OpenUiTextField } from "../components-react/v2";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

describe("Open UI adapters", () => {
  it("renders shared panels on top of Semi Design Card", () => {
    const { container } = render(
      <OpenUiProvider>
        <OpenUiPanel title="Event identity" subtitle="Neo Builder Summit" titleId="event-title" icon={<span data-testid="panel-icon" />}>
          <p>Panel body</p>
        </OpenUiPanel>
      </OpenUiProvider>,
    );

    expect(container.querySelector(".semi-card.mx2-open-panel")).toBeTruthy();
    expect(container.querySelector(".mx2-open-panel__head")).toBeTruthy();
    expect(container.querySelector("#event-title")?.textContent).toBe("Event identity");
    expect(container.querySelector(".mx2-open-panel__copy")?.textContent).toContain("Neo Builder Summit");
    expect(container.textContent).toContain("Panel body");
  });

  it("renders shared notices on top of Semi Design Banner", () => {
    const { container } = render(
      <OpenUiProvider>
        <OpenUiNotice title="Create a pass first" icon={<span data-testid="notice-icon" />}>
          Design the event identity before issuing tickets.
        </OpenUiNotice>
      </OpenUiProvider>,
    );

    expect(container.querySelector(".semi-banner.mx2-open-notice")).toBeTruthy();
    expect(container.querySelector(".mx2-open-notice__icon")).toBeTruthy();
    expect(container.querySelector(".semi-banner-close")).toBeNull();
    expect(container.textContent).toContain("Create a pass first");
    expect(container.textContent).toContain("Design the event identity before issuing tickets.");
  });

  it("renders shared text fields with the Open UI field contract", () => {
    let nextValue = "";
    const { container } = render(
      <OpenUiProvider>
        <OpenUiTextField
          label="Market Hash"
          value="0x1234567890abcdef1234567890abcdef12345678"
          onChange={(event) => {
            nextValue = event.target.value;
          }}
          mono
          hint="Editable market route"
        />
      </OpenUiProvider>,
    );

    expect(container.querySelector(".mx2-open-field.mx2-open-field--mono")).toBeTruthy();
    expect(container.querySelector(".mx2-open-field__control.semi-input-wrapper input.semi-input")).toBeTruthy();
    const input = container.querySelector<HTMLInputElement>(".mx2-open-field__control input.semi-input");
    expect(container.querySelector(".mx2-open-field__label")?.textContent).toBe("Market Hash");
    expect(container.querySelector(".mx2-open-field__hint")?.textContent).toBe("Editable market route");
    expect(input?.value).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(input?.id).not.toContain(":");
    fireEvent.change(input!, { target: { value: "0xfeed" } });
    expect(nextValue).toBe("0xfeed");
  });

  it("renders shared text areas with the Open UI field contract", () => {
    const { container } = render(
      <OpenUiProvider>
        <OpenUiTextArea
          label="Payload JSON"
          value="{}"
          onChange={() => undefined}
          hint="Relay payload"
          rows={3}
        />
      </OpenUiProvider>,
    );

    expect(container.querySelector(".mx2-open-field.mx2-open-field--textarea")).toBeTruthy();
    expect(container.querySelector(".mx2-open-field__control--textarea.semi-input-textarea-wrapper textarea.semi-input-textarea")).toBeTruthy();
    const textarea = container.querySelector<HTMLTextAreaElement>(".mx2-open-field__control--textarea textarea.semi-input-textarea");
    expect(container.querySelector(".mx2-open-field__label")?.textContent).toBe("Payload JSON");
    expect(container.querySelector(".mx2-open-field__hint")?.textContent).toBe("Relay payload");
    expect(textarea?.value).toBe("{}");
    expect(textarea?.id).not.toContain(":");
  });

  it("renders shared selects with the Open UI field contract", () => {
    const { container } = render(
      <OpenUiProvider>
        <OpenUiSelect
          label="Policy method"
          value="setFeePerByte"
          onChange={() => undefined}
          options={[
            { value: "setFeePerByte", label: "Fee per byte" },
            { value: "setStoragePrice", label: "Storage price" },
          ]}
          hint="Network parameter"
        />
      </OpenUiProvider>,
    );

    expect(container.querySelector(".mx2-open-field.mx2-open-field--select")).toBeTruthy();
    expect(container.querySelector(".semi-select.mx2-open-field__control--select")).toBeTruthy();
    expect(container.querySelector(".mx2-open-field__label")?.textContent).toBe("Policy method");
    expect(container.querySelector(".mx2-open-field__hint")?.textContent).toBe("Network parameter");
    expect(container.querySelector(".mx2-open-field__control--select")?.id).not.toContain(":");
  });

  it("renders compact segmented choices for small decision sets", () => {
    const { container } = render(
      <OpenUiProvider>
        <OpenUiSegmented
          label="Motion type"
          value="text"
          onChange={() => undefined}
          options={[
            { value: "text", label: "Text motion" },
            { value: "policy", label: "Policy change" },
          ]}
          hint="Use for app-like choices instead of a large select."
        />
      </OpenUiProvider>,
    );

    expect(container.querySelector(".mx2-open-field.mx2-open-field--segmented")).toBeTruthy();
    expect(container.querySelector(".semi-radioGroup.mx2-open-segmented")).toBeTruthy();
    expect(container.querySelector(".mx2-open-field__label")?.textContent).toBe("Motion type");
    expect(container.querySelector(".mx2-open-field__hint")?.textContent).toBe("Use for app-like choices instead of a large select.");
  });
});
