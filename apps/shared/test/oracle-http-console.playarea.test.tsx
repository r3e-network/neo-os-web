import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-http-console/src/PlayArea";
import { consoleConfig } from "../../oracle-http-console/src/appConfig";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string) {
  const m: Record<string,string> = {
    buildRequest: "Prepare Payload",
    copyPayload: "Copy Morpheus payload",
    payloadCopied: "Morpheus payload copied",
    digestPlaceholder: "No draft digest",
    httpEmptyTitle: "Preview the oracle intent",
    httpFlowTitle: "Oracle request flow",
    httpPipelineCopy: "Compose the source, extraction path, and optional body as one reviewable oracle route.",
    httpPipelineTitle: "Request pipeline",
    httpReady: "Morpheus payload ready",
    httpInputsReady: "Ready to prepare",
    httpDraftChanged: "Draft changed — prepare again",
    httpRequestPlan: "Request plan",
    httpResultPreview: "Preview receipt",
    httpRouteDigestNode: "Preview marker",
    httpRouteExtractNode: "Extractor",
    httpRouteSourceNode: "Source node",
    httpRouteWorkbench: "Live oracle route",
    httpSignalsLabel: "Route signals",
    httpSourceLabel: "Source",
    httpUrlReadyHint: "Public HTTP endpoint ready for preview.",
    httpValidationReady: "Inputs ready",
    httpPathReadyHint: "Morpheus dot path is ready.",
    httpMethodTitle: "Transport mode",
    httpMethodGetHint: "Read a public endpoint without a request body.",
    httpMethodPostHint: "Include compact JSON in the local draft digest.",
    httpBodyGetHint: "Disabled for GET because its payload omits request bodies.",
    httpBodyPostHint: "Included only for POST and folded into the draft digest.",
    httpBodyInvalidJson: "POST body must be valid JSON",
    httpBodyTooLarge: "Keep the POST body within 32 KiB",
    httpBodyState: "Body",
    httpBodyIncluded: "Body included",
    httpBodyEmpty: "No POST body",
    httpBodyIgnored: "No body for GET",
    copyingPayload: "Copying payload...",
    httpInvalidPath: "Enter a valid JSON path",
    httpInvalidUrl: "Enter a valid http(s) URL",
    httpUrlCredentialsBlocked: "Remove credentials from the URL before previewing.",
    httpUrlFragmentBlocked: "Remove the URL fragment; fragments are not sent in HTTP requests.",
    httpUrlPrivateHostBlocked: "Use a public endpoint; local and private-network hosts cannot be prepared for the oracle lane.",
    httpUrlInvalidHint: "Use a valid http(s) URL before previewing.",
    httpPathInvalidHint: "Start with $ and avoid unfinished brackets or trailing dots.",
    httpStatusLabel: "HTTP request status",
    detailsLabel: "Details",
    body: "Body",
    bodyPlaceholder: "Optional POST body",
    jsonPath: "JSON Path",
    jsonPathPlaceholder: "status",
    lastStatus: "Status",
    method: "Method",
    panelEyebrow: "Oracle",
    panelTitle: "Console",
    pathValid: "Path valid",
    previewingRequest: "Routing request...",
    statDigest: "Draft digest",
    statRequests: "Requests",
    statusReady: "Ready",
    url: "URL",
    urlPlaceholder: "https://morpheus.example/health",
    reset: "Reset",
  };
  return m[key] ?? key;
}
function state(o: Partial<Record<string,unknown>> = {}): ObservableState {
  const b: Record<string,unknown> = { networkLabel:"Mainnet", endpointLabel:"Local builder", lastStatus:"Ready", lastDigest:"No draft digest", requestCount:0, ...o };
  return Object.fromEntries(Object.entries(b).map(([k,v]) => [k, createObservable(v)]));
}
function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}
function playAreaSource(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.tsx"), "utf8");
}
describe("oracle-http-console PlayArea (v2)", () => {
  it("renders a foreground HTTP oracle pipeline instead of a tiny status ticket", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".oracle-http-workbench")).toBeTruthy();
    expect(container.querySelector(".oracle-http-request")).toBeTruthy();
    expect(container.querySelector(".oracle-http-lane")).toBeTruthy();
    expect(container.querySelector(".oracle-http-lane__art img")?.getAttribute("src")).toContain("http-oracle-pipeline.webp");
    expect(container.querySelector(".oracle-http-receipt")).toBeTruthy();
    expect(container.querySelectorAll(".oracle-http-track__item")).toHaveLength(3);
    expect(container.textContent).toContain("Request pipeline");
    expect(container.textContent).toContain("Preview receipt");
    expect(container.textContent).not.toContain("⚡");
  });

  it("keeps Prepare Payload wired to the preview action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Prepare Payload/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      method: "GET",
      jsonPath: "status",
      body: "",
    }));
  });

  it("keeps editable HTTP parameters in the drawer and dispatches the composed request", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelector(".mx2-stage__scene input, .mx2-stage__scene textarea")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".oracle-http-composer input.semi-input"));
    const body = container.querySelector<HTMLTextAreaElement>(".oracle-http-field--body textarea.semi-input-textarea");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(body).toBeTruthy();

    fireEvent.click(screen.getByText("POST"));
    fireEvent.change(inputs[0], { target: { value: "https://api.example.test/prices" } });
    fireEvent.change(inputs[1], { target: { value: "$.data.price" } });
    fireEvent.change(body as HTMLTextAreaElement, { target: { value: "{\"symbol\":\"GAS\"}" } });
    fireEvent.click(screen.getByRole("button", { name: /Prepare Payload/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      method: "POST",
      url: "https://api.example.test/prices",
      jsonPath: "$.data.price",
      body: "{\"symbol\":\"GAS\"}",
    }));
  });

  it("blocks invalid URL or extraction path before preparing a payload", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".oracle-http-composer input.semi-input"));
    const primary = screen.getByRole("button", { name: /Prepare Payload/ }) as HTMLButtonElement;

    fireEvent.change(inputs[0], { target: { value: "ftp://example.test/feed" } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Enter a valid http(s) URL");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalledWith("buildRequest", expect.anything());

    fireEvent.change(inputs[0], { target: { value: "http://127.0.0.1/private" } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Use a public endpoint");

    fireEvent.change(inputs[0], { target: { value: "https://api.example.test/feed" } });
    fireEvent.change(inputs[1], { target: { value: "status." } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Enter a valid JSON path");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalledWith("buildRequest", expect.anything());
  });

  it("uses a task-mode Open UI details drawer instead of raw paragraphs", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".oracle-http-drawer__switcher-group .semi-radio"));

    expect(tabs).toHaveLength(3);
    expect(container.querySelector(".oracle-http-drawer__switcher-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll('.oracle-http-drawer__switcher [role="tab"]')).toHaveLength(0);
    expect(container.querySelectorAll(".oracle-http-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".oracle-http-drawer__facts")).toBeTruthy();
    expect(container.querySelector(".oracle-http-drawer h4")).toBeNull();

    fireEvent.click(tabs[1]);
    expect(container.querySelectorAll(".oracle-http-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".oracle-http-drawer__route")).toBeTruthy();

    fireEvent.click(tabs[2]);
    expect(container.querySelectorAll(".oracle-http-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".oracle-http-drawer__digest")).toBeTruthy();
  });

  it("copies only the exact Morpheus payload that matches the prepared digest", () => {
    const defaults = Object.fromEntries(
      consoleConfig.fields.map((field) => [field.key, String(field.defaultValue ?? "")]),
    );
    const prepared = consoleConfig.buildResult(defaults, t);
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastDigest: prepared.payload.digest })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".oracle-http-drawer__switcher-group .semi-radio"));
    fireEvent.click(tabs[2]);
    fireEvent.click(screen.getByRole("button", { name: /Copy Morpheus payload/ }));

    expect(dispatch).toHaveBeenCalledWith(
      "copyPayload",
      expect.stringContaining('"json_path": "status"'),
    );
    expect(dispatch.mock.calls.at(-1)?.[1]).not.toContain("digest");
  });

  it("keeps payload copying single-flight until clipboard completion", async () => {
    const defaults = Object.fromEntries(
      consoleConfig.fields.map((field) => [field.key, String(field.defaultValue ?? "")]),
    );
    const prepared = consoleConfig.buildResult(defaults, t);
    let finishCopy: (value: boolean) => void = () => undefined;
    const dispatch = vi.fn((name: string) => name === "copyPayload"
      ? new Promise<boolean>((resolve) => { finishCopy = resolve; })
      : Promise.resolve(undefined));
    const { container } = render(
      <PlayArea t={t} state={state({ lastDigest: prepared.payload.digest })} dispatch={dispatch} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".oracle-http-drawer__switcher-group .semi-radio"));
    fireEvent.click(tabs[2]);
    const copy = screen.getByRole("button", { name: /Copy Morpheus payload/ }) as HTMLButtonElement;
    fireEvent.click(copy);
    fireEvent.click(copy);

    expect(dispatch.mock.calls.filter(([name]) => name === "copyPayload")).toHaveLength(1);
    expect(copy.disabled).toBe(true);
    finishCopy(true);
    await waitFor(() => expect(screen.getByRole("button", { name: /Morpheus payload copied/ })).toBeTruthy());
  });

  it("invalidates a stale receipt after the draft changes and resets kernel state", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({ lastDigest: `0x${"a".repeat(64)}` })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getAllByText("Draft changed — prepare again").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(dispatch).toHaveBeenCalledWith("resetRequest");
  });

  it("blocks malformed JSON bodies before a POST draft can be prepared", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    fireEvent.click(screen.getByText("POST"));
    const body = container.querySelector<HTMLTextAreaElement>(".oracle-http-field--body textarea.semi-input-textarea");
    fireEvent.change(body as HTMLTextAreaElement, { target: { value: "{bad-json}" } });

    const primary = screen.getByRole("button", { name: /Prepare Payload/ }) as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("POST body must be valid JSON");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalledWith("buildRequest", expect.anything());
  });

  it("keeps the scene scoped, clean, and motion-accessible", () => {
    const s = playAreaStyles("oracle-http-console");
    const source = playAreaSource("oracle-http-console");

    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).toContain("OpenUiTextArea");
    expect(source).toContain("if (!canPreview) return;");
    expect(source).toContain("disabled: !canPreview || actionPreview");
    expect(source).toContain('dispatch("buildRequest", {');
    expect(source).toContain('dispatch("copyPayload"');
    expect(source).toContain('dispatch("resetRequest")');
    expect(source).toContain('dispatch("invalidateRequest")');
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(s).toContain("@media (prefers-reduced-motion: reduce)");
    expect(s).toMatch(/animation-duration:\s*0\.001ms/);
    expect(s).toMatch(/\.oracle-console-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(s).toMatch(/\.oracle-console-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.oracle-console-play-area \.mx2-stage__scene\s*\{[\s\S]*padding:\s*12px/);
    expect(s).toMatch(/\.oracle-http-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.04fr\) minmax\(300px,\s*0\.96fr\)/);
    expect(s).toMatch(/\.oracle-http-workbench\s*\{[\s\S]*align-items:\s*start/);
    expect(s).toMatch(/\.oracle-http-workbench\s*\{[\s\S]*border:\s*0/);
    expect(s).toMatch(/\.oracle-http-workbench\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.oracle-http-track\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    // Re-pinned 2026-07-16: this pinned `height: 214px` — the same defect the
    // mobile band had (see the aspect-ratio guard below), one breakpoint up. At
    // the desktop column width the 16:9 art wants ~298px, so a fixed 214px band
    // cropped the illustration via `overflow: hidden`, AND left the workbench
    // 84px short inside the 628px desktop scene, whose `align-items: center`
    // split the shortfall into ~127px of dead white above the cards and ~128px
    // below. The guard's intent is kept — the desktop band is deliberately
    // sized here, not left unbounded — but stated as "the figure takes the
    // picture's height" rather than a magic number that fights the art.
    expect(s).toMatch(/\.oracle-http-lane__art\s*\{[\s\S]*height:\s*auto/);
    expect(s).toMatch(/\.oracle-http-lane__art img\s*\{[\s\S]*height:\s*auto/);
    expect(s).toMatch(/\.oracle-http-lane__art img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.oracle-http-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.oracle-http-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.oracle-http-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.oracle-http-composer__grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\) minmax\(190px,\s*0\.75fr\)/);
    expect(s).toMatch(/\.oracle-http-input--body\.mx2-open-field__control--textarea\s*\{[\s\S]*resize:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-track,\s*\n\s*\.oracle-http-receipt__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-request__copy\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-track__item small\s*\{[\s\S]*display:\s*none/);
    // Re-pinned 2026-07-15: this pinned `height: 92px`, which was the defect —
    // against `object-fit: contain` a fixed 92px band letterboxed the 16:9
    // pipeline art down to a ~140px-wide stamp adrift in a ~334px white card,
    // reading as a broken image rather than art. The guard's intent is kept
    // (the mobile band is deliberately sized here, not left unbounded), but
    // stated as the picture's own ratio so the art meets both edges of the card
    // at every width instead of depending on one magic number.
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-lane__art\s*\{[\s\S]*aspect-ratio:\s*1672\s*\/\s*941/);
    // The values in the 3-up pipeline tiles must stay wrappable at 390px: with
    // `white-space: nowrap` they each ellipsised ("Not prepare…", "oracle.mesh…").
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-source-strip code\s*\{[\s\S]*white-space:\s*normal/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-composer__grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-console-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.oracle-console-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).toMatch(/@keyframes oracle-http-pulse/);
    expect(s).toMatch(/\.oracle-http-copy-action\s*\{[\s\S]*width:\s*fit-content/);
    expect(s).not.toMatch(/gradient/);
    expect(s).not.toMatch(/oracle-console-scene__backdrop/);
    expect(s).not.toMatch(/oracle-console-scene__ticket/);
    expect(s).not.toMatch(/\.tool-scene__backdrop/);
    expect(s).not.toMatch(/oracle-console-scene__icon/);
  });
});
