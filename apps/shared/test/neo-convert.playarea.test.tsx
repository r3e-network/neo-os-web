import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-convert/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

describe("neo-convert PlayArea (v2)", () => {
  it("renders a clean converter workbench with structured output", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          activeTab: "convert",
          accountsGenerated: "2",
          conversionResult: {
            address: "Nabc123",
            publicKey: "",
            wif: "",
            privateKey: "",
            opcodes: [],
            scriptHash: "0xabc",
            scriptHashLE: "bc0x",
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".convert-workbench")).toBeTruthy();
    expect(container.querySelector(".convert-format-rail")).toBeTruthy();
    expect(container.querySelector(".convert-material")).toBeTruthy();
    expect(container.querySelectorAll(".mx2-stage__scene input")).toHaveLength(1);
    expect(container.querySelector(".convert-material--scene")).toBeTruthy();
    expect((screen.getByPlaceholderText("sourceCredentialPlaceholder") as HTMLInputElement).type).toBe("password");
    expect(container.querySelector(".convert-resource-card img")?.getAttribute("src")).toContain("key-workbench-stage.webp");
    expect(container.querySelector(".convert-output-preview")).toBeTruthy();
    expect(container.textContent).toContain("Nabc123");
    expect(container.textContent).not.toContain("[object Object]");
    expect(container.textContent).not.toMatch(/🔑|🔄/);
  });

  it("dispatches convert with the typed value and exposes account generation separately", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ inputKey: "" })} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("generateNewAccount"));
    expect(container.querySelectorAll(".mx2-stage__scene input")).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("sourceCredentialPlaceholder"), {
      target: { value: "NtypedAddress" },
    });
    fireEvent.click(screen.getByRole("button", { name: /convert/ }));

    expect(dispatch).toHaveBeenCalledWith("generate");
    expect(dispatch).toHaveBeenCalledWith("convert", "NtypedAddress");
  });

  it("keeps the source masked, converts on Enter, and exposes an explicit session clear", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ inputKey: "" })} dispatch={dispatch} />);
    const input = screen.getByPlaceholderText("sourceCredentialPlaceholder") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "NtypedAddress" } });
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "showSource" }));
    expect(input.type).toBe("text");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(dispatch).toHaveBeenCalledWith("convert", "NtypedAddress");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: "clearWorkbench" }));
    expect(dispatch).toHaveBeenCalledWith("reset");
  });

  it("keeps generated secrets out of the DOM until the user explicitly reveals them", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const generatedAccount = {
      address: "NgeneratedAddress",
      publicKey: `02${"ab".repeat(32)}`,
      privateKey: "11".repeat(32),
      wif: "Lgenerated-secret-wif",
    };
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state({
          activeTab: "tabGenerate",
          generatedAccount,
          accountsGenerated: "1",
          showGeneratedSecrets: false,
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("NgeneratedAddress")).toBeTruthy();
    fireEvent.click(screen.getByText("inspectDetails"));
    expect(screen.queryByText(generatedAccount.wif)).toBeNull();
    expect(screen.queryByText(generatedAccount.privateKey)).toBeNull();
    expect(screen.getAllByText("secretHidden")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "downloadPdf" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /showSecrets/ }));
    expect(dispatch).toHaveBeenCalledWith("toggleGeneratedSecrets");

    rerender(
      <PlayArea
        t={t}
        state={state({
          activeTab: "tabGenerate",
          generatedAccount,
          accountsGenerated: "1",
          showGeneratedSecrets: true,
        })}
        dispatch={dispatch}
      />,
    );
    expect(screen.getByText(generatedAccount.wif)).toBeTruthy();
    expect(screen.getByText(generatedAccount.privateKey)).toBeTruthy();
    expect((screen.getByRole("button", { name: "downloadPdf" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps WIF and private-key conversion output masked by default", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const result = {
      address: "Nconverted",
      publicKey: `03${"cd".repeat(32)}`,
      wif: "Lconverted-secret-wif",
      privateKey: "22".repeat(32),
      opcodes: [],
      scriptHash: "",
      scriptHashLE: "",
    };
    render(
      <PlayArea
        t={t}
        state={state({
          activeTab: "tabConvert",
          conversionResult: result,
          conversionStatus: "detectedWif",
          conversionStatusType: "success",
          showConversionSecrets: false,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByText("inspectDetails"));
    expect(screen.queryByText(result.wif)).toBeNull();
    expect(screen.queryByText(result.privateKey)).toBeNull();
    expect(screen.getAllByText("secretHidden")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /showSecrets/ }));
    expect(dispatch).toHaveBeenCalledWith("toggleConversionSecrets");
  });

  it("does not present a generated address as the result of newly edited source material", () => {
    const generatedAccount = {
      address: "NgeneratedAddress",
      publicKey: `02${"ab".repeat(32)}`,
      privateKey: "11".repeat(32),
      wif: "Lgenerated-secret-wif",
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ inputKey: "new-source", generatedAccount })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".convert-output-preview")?.textContent).toContain("emptyOutputTitle");
    expect(container.querySelector(".convert-card--output small")?.textContent).toBe("localConversionNote");
  });

  it("imports v2 styles and keeps the scene foreground-led", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-convert/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${process.cwd()}/../neo-convert/src/PlayArea.tsx`, "utf8");

    expect(source).toContain("OpenUiProvider");
    expect(source).toContain("OpenUiTextField");
    expect(source).toContain("dispatchSafely");
    expect(source).toContain(".catch(() => undefined)");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).toContain('import { CoinArt } from "@shared/art";');
    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.convert-card\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.convert-source-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(164px,\s*0\.42fr\)/);
    expect(s).toMatch(/\.convert-material--scene\[data-ready="true"\]\s*\{[\s\S]*background:\s*#f8fffd/);
    expect(s).toMatch(/\.convert-entry-input\.mx2-open-field__control\s*\{[\s\S]*border:\s*0/);
    expect(s).toMatch(/\.convert-entry-input \.semi-input\s*\{[\s\S]*font-family:\s*ui-monospace/);
    expect(s).toMatch(/\.convert-format-rail__items\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(s).toMatch(/\.convert-format-rail__items span\s*\{[\s\S]*flex:\s*0 0 104px/);
    expect(s).toMatch(/\.convert-resource-card img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.neo-convert-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
    expect(s).toMatch(/\.convert-card--output\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.convert-material\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.convert-rail__line\s*\{[\s\S]*background:\s*var\(--mx2-brand-subtle\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.convert-format-rail__items small\s*\{[\s\S]*display:\s*none/);
    expect(s).not.toMatch(/AI-generated scene backdrop/);
    expect(s).not.toMatch(/__backdrop/);
    expect(s).not.toMatch(/convert-detector/);
    expect(s).not.toMatch(/font-size:\s*clamp/);
    expect(s).not.toMatch(/convert-card--output[\s\S]*linear-gradient/);
    expect(s).not.toMatch(/\.convert-material--summary|\.convert-field--drawer/);
  });
});
