// =============================================================================
// DemoDataBanner Component Tests
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DemoDataBanner,
  isMockDataResponse,
  MOCK_DATA_HEADER,
} from "../DemoDataBanner";

describe("DemoDataBanner Component", () => {
  it("renders the demo-data notice as a status region", () => {
    render(<DemoDataBanner />);
    const banner = screen.getByTestId("demo-data-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveTextContent("Demo data");
    expect(banner).toHaveTextContent("changes are not persisted");
  });

  it("renders optional children and merges class names", () => {
    render(<DemoDataBanner className="mt-2">extra detail</DemoDataBanner>);
    const banner = screen.getByTestId("demo-data-banner");
    expect(banner).toHaveClass("mt-2");
    expect(banner).toHaveTextContent("extra detail");
  });
});

describe("isMockDataResponse", () => {
  it("is true only when the X-Mock-Data header is 'true'", () => {
    expect(
      isMockDataResponse(new Response("{}", { headers: { [MOCK_DATA_HEADER]: "true" } })),
    ).toBe(true);
    expect(
      isMockDataResponse(new Response("{}", { headers: { [MOCK_DATA_HEADER]: "false" } })),
    ).toBe(false);
    expect(isMockDataResponse(new Response("{}"))).toBe(false);
  });
});
