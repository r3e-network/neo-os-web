import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-http-console/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string) {
  const m: Record<string,string> = {
    buildRequest: "Build Request",
    digestPlaceholder: "No digest",
    httpEmptyTitle: "Preview the oracle intent",
    httpFlowTitle: "Oracle request flow",
    httpPipelineCopy: "Compose the source, extraction path, and optional body as one reviewable oracle route.",
    httpPipelineTitle: "Request pipeline",
    httpReady: "HTTP request ready",
    httpRequestPlan: "Request plan",
    httpResultPreview: "Preview receipt",
    httpRouteDigestNode: "Digest beacon",
    httpRouteExtractNode: "Extractor",
    httpRouteSourceNode: "Source node",
    httpRouteWorkbench: "Live oracle route",
    httpSignalsLabel: "Route signals",
    httpSourceLabel: "Source",
    httpUrlReadyHint: "Ready for oracle preview.",
    httpValidationReady: "Inputs ready",
    httpPathReadyHint: "JSONPath syntax is ready.",
    httpMethodTitle: "Transport mode",
    httpMethodGetHint: "Read a public endpoint without a request body.",
    httpMethodPostHint: "Include a compact body in the preview digest.",
    httpBodyGetHint: "Disabled for GET because the digest omits request bodies.",
    httpBodyPostHint: "Included only for POST and folded into the digest.",
    httpBodyState: "Body",
    httpBodyIncluded: "Body included",
    httpBodyIgnored: "No body for GET",
    httpInvalidPath: "Enter a valid JSON path",
    httpInvalidUrl: "Enter a valid http(s) URL",
    httpUrlInvalidHint: "Use a valid http(s) URL before previewing.",
    httpPathInvalidHint: "Start with $ and avoid unfinished brackets or trailing dots.",
    httpStatusLabel: "HTTP request status",
    detailsLabel: "Details",
    body: "Body",
    bodyPlaceholder: "Optional POST body",
    jsonPath: "JSON Path",
    jsonPathPlaceholder: "$.status",
    lastStatus: "Status",
    method: "Method",
    panelEyebrow: "Oracle",
    panelTitle: "Console",
    pathValid: "Path valid",
    previewingRequest: "Routing request...",
    statDigest: "Digest",
    statRequests: "Requests",
    statusReady: "Ready",
    url: "URL",
    urlPlaceholder: "https://morpheus.example/health",
    reset: "Reset",
  };
  return m[key] ?? key;
}
function state(o: Partial<Record<string,unknown>> = {}): ObservableState {
  const b: Record<string,unknown> = { networkLabel:"Mainnet", endpointLabel:"Preview", lastStatus:"Ready", lastDigest:"No digest", requestCount:0, ...o };
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

  it("keeps Build Request wired to the preview action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Build Request/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      method: "GET",
      jsonPath: "$.status",
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
    fireEvent.click(screen.getByRole("button", { name: /Build Request/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      method: "POST",
      url: "https://api.example.test/prices",
      jsonPath: "$.data.price",
      body: "{\"symbol\":\"GAS\"}",
    }));
  });

  it("blocks invalid URL or JSONPath before dispatching preview", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".oracle-http-composer input.semi-input"));
    const primary = screen.getByRole("button", { name: /Build Request/ }) as HTMLButtonElement;

    fireEvent.change(inputs[0], { target: { value: "ftp://example.test/feed" } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Enter a valid http(s) URL");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(inputs[0], { target: { value: "https://api.example.test/feed" } });
    fireEvent.change(inputs[1], { target: { value: "status." } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Enter a valid JSON path");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalled();
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

  it("keeps the scene scoped, clean, and motion-accessible", () => {
    const s = playAreaStyles("oracle-http-console");
    const source = playAreaSource("oracle-http-console");

    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).toContain("OpenUiTextArea");
    expect(source).toContain("if (!canPreview) return;");
    expect(source).toContain("disabled: !canPreview || actionPreview");
    expect(source).toContain('dispatch("buildRequest", values)');
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
    expect(s).toMatch(/\.oracle-http-lane__art\s*\{[\s\S]*height:\s*214px/);
    expect(s).toMatch(/\.oracle-http-lane__art img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.oracle-http-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.oracle-http-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.oracle-http-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.oracle-http-composer__grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\) minmax\(190px,\s*0\.75fr\)/);
    expect(s).toMatch(/\.oracle-http-input--body\.mx2-open-field__control--textarea\s*\{[\s\S]*resize:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-track,\s*\n\s*\.oracle-http-receipt__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-request__copy\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-track__item small\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-lane__art\s*\{[\s\S]*height:\s*92px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-composer__grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-http-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.oracle-console-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.oracle-console-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).toMatch(/@keyframes oracle-http-pulse/);
    expect(s).not.toMatch(/gradient/);
    expect(s).not.toMatch(/oracle-console-scene__backdrop/);
    expect(s).not.toMatch(/oracle-console-scene__ticket/);
    expect(s).not.toMatch(/\.tool-scene__backdrop/);
    expect(s).not.toMatch(/oracle-console-scene__icon/);
  });
});
