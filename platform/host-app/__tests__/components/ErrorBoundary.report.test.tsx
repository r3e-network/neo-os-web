/**
 * ErrorBoundary "Report Issue" support-channel tests.
 *
 * Regression for the shipped placeholder: the button used to open
 * `mailto:support@example.com` — a non-existent address. It must open a
 * prefilled report on the platform's real support channel (BRAND.supportUrl).
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/lib/monitoring/errors", () => ({
  trackError: jest.fn(() => "err_report_test"),
  getTrackedErrors: jest.fn(() => []),
  getErrorCount: jest.fn(() => 0),
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { ErrorBoundary } from "../../components/ErrorBoundary";
import { BRAND, buildSupportIssueUrl } from "../../lib/brand";

function Bomb(): React.ReactElement {
  throw new Error("kaboom");
}

describe("ErrorBoundary report channel", () => {
  let openSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    // React logs caught render errors; keep test output clean.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    openSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("opens a prefilled issue on the real support channel, not a mailto placeholder", () => {
    render(
      <ErrorBoundary componentName="BombHost">
        <Bomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Report Issue" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(String(url)).not.toMatch(/^mailto:/);
    expect(String(url)).not.toContain("example.com");
    expect(String(url).startsWith(BRAND.supportUrl)).toBe(true);
    expect(String(url)).toContain("title=");
    expect(decodeURIComponent(String(url))).toContain("kaboom");
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");
  });
});

describe("buildSupportIssueUrl", () => {
  it("prefills title and body query params on the support URL", () => {
    const url = new URL(
      buildSupportIssueUrl({ title: "Error Report: e-1", body: "line1\nline2" }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(BRAND.supportUrl);
    expect(url.searchParams.get("title")).toBe("Error Report: e-1");
    expect(url.searchParams.get("body")).toBe("line1\nline2");
  });
});
