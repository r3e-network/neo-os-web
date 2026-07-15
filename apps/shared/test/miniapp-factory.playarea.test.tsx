import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../miniapp-factory/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(`{${name}}`, String(value)),
    key,
  );
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function appPath(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "miniapp-factory", file);
}

const LAUNCH_WITH_OWNER =
  "https://neomini.app/miniapps/miniapp-factory/index.html?network=testnet&owner=NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
/** A cold store visit: no host params at all, so `admin` starts empty. */
const LAUNCH_COLD = "https://neomini.app/miniapps/miniapp-factory/index.html";

function renderStudio(launchUrl: string = LAUNCH_WITH_OWNER) {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <PlayArea
      t={t}
      state={state({
        draftJournalState: "ready",
        artifactPresence: {},
        walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        deployments: [],
        deploymentsTotal: 0,
        deploymentsState: "ready",
        registrationState: "idle",
      })}
      dispatch={dispatch}
      launchContext={parseMiniAppLaunchContext(launchUrl, "miniapp-miniapp-factory")}
    />,
  );
  return { ...view, dispatch };
}

function adminInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector(".miniapp-studio__admin-field input") as HTMLInputElement;
}

describe("MiniApp Studio PlayArea", () => {
  it("renders the real studio scene, four experience choices and one bounded primary action", () => {
    const { container } = renderStudio();

    const image = container.querySelector(".miniapp-studio__media img") as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.src).toContain("miniapp-launch-studio.webp");
    expect(image.alt).toBe("studioImageAlt");
    expect(container.querySelectorAll(".miniapp-studio__template-shelf [role='radio']")).toHaveLength(4);
    expect(container.querySelectorAll(".miniapp-studio__primary")).toHaveLength(1);
    expect(container.querySelectorAll(".miniapp-studio__drawer").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".miniapp-studio__app-card")).toBeTruthy();
  });

  it("updates the product preview through visual template cards instead of a type input", () => {
    const { container } = renderStudio();
    const options = container.querySelectorAll<HTMLButtonElement>(
      ".miniapp-studio__template-shelf [role='radio']",
    );

    fireEvent.click(options[3]);

    expect(options[3].getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector(".miniapp-studio__app-card")?.getAttribute("data-tone")).toBe("violet");
    expect(container.querySelector(".miniapp-studio__app-card")?.textContent).toContain(
      "templateKindOracleConsole",
    );
    expect(container.querySelector("select")).toBeNull();
  });

  it("keeps admin, capabilities, files, signature and history secondary", () => {
    const { container } = renderStudio();
    const advanced = container.querySelector(".miniapp-studio__advanced") as HTMLDetailsElement;
    const artifacts = container.querySelector(".miniapp-studio__drawer[data-kind='artifacts']") as HTMLDetailsElement;
    const history = container.querySelector(".miniapp-studio__drawer[data-kind='operations']") as HTMLDetailsElement;

    expect(advanced).toBeTruthy();
    expect(artifacts).toBeTruthy();
    expect(history).toBeTruthy();
    expect(container.querySelector(".miniapp-studio__artifact-panel header button")?.hasAttribute("disabled")).toBe(true);
  });

  // A pristine required field is a normal first-run state, not a mistake the
  // visitor has made. The studio used to open with the admin input already
  // outlined red and "Admin must be a Neo N3 address or Hash160." printed under
  // it before a single keystroke.
  it("opens a cold visit with no error styling on the untouched admin field", () => {
    const { container } = renderStudio(LAUNCH_COLD);
    const input = adminInput(container);

    expect(input.value).toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    // Neutral hint, not the blocking-error string.
    expect(container.querySelector(".miniapp-studio__admin-field small")?.textContent).toBe(
      "adminHint",
    );
    // The placeholder names the accepted formats; a literal "N..." read as
    // truncated/broken text.
    expect(input.placeholder).toBe("adminPlaceholder");
    // The section that holds the outstanding detail is still revealed.
    expect(
      (container.querySelector(".miniapp-studio__advanced") as HTMLDetailsElement).open,
    ).toBe(true);
    // ...and the CTA hint names the field instead of pointing at a highlight
    // that does not exist yet.
    expect(container.querySelector(".miniapp-studio__primary-hint")?.textContent).toBe(
      "adminNeededHint",
    );
  });

  it("raises the admin error once the field is touched, and for a non-empty bad value", () => {
    const { container } = renderStudio(LAUNCH_COLD);
    const input = adminInput(container);

    fireEvent.change(input, { target: { value: "not-an-address" } });

    expect(adminInput(container).getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".miniapp-studio__admin-field small")?.textContent).toBe(
      "errAdminAddress",
    );
    expect(container.querySelector(".miniapp-studio__primary-hint")?.textContent).toBe(
      "fixHighlightedFields",
    );
  });

  // Store-facing entry chrome must not headline a TESTNET badge. The precise
  // network still appears where it is load-bearing (register CTA, wallet
  // guard) — this guard only pins the entry surface.
  it("keeps testnet branding off the entry chrome", () => {
    const { container } = renderStudio(LAUNCH_COLD);

    expect(container.querySelector(".miniapp-studio__network")?.textContent).toContain(
      "registryScope",
    );
    expect(container.querySelector(".miniapp-studio__fixed-network")?.textContent).toContain(
      "fixedRegistryTarget",
    );
    expect(container.textContent).not.toContain("testnetOnly");
  });

  it("owns the app surface instead of importing the generic Factory form runtime", () => {
    const main = readFileSync(appPath("src/main.tsx"), "utf8");
    const source = readFileSync(appPath("src/PlayArea.tsx"), "utf8");
    const manifest = readFileSync(appPath("src/manifest.ts"), "utf8");

    expect(main).toContain("MiniAppFactoryPlayArea");
    expect(main).toContain("createMiniAppFactorySetup");
    expect(main).not.toContain("createFactoryPlayArea");
    expect(main).not.toContain("createFactorySetup");
    expect(source).toContain("miniapp-launch-studio.webp");
    expect(source).not.toContain("<select");
    expect(manifest).toContain("tabs: []");
    expect(manifest).toContain("stats: []");
    expect(manifest).toContain("operations: []");
  });
});
