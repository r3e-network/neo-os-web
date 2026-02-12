// =============================================================================
// Badge Component Tests
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge Component", () => {
  it("should render badge with text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("should apply default variant by default", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("bg-muted/30");
    expect(badge).toHaveClass("text-muted-foreground");
  });

  it("should apply success variant", () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText("Success");
    expect(badge).toHaveClass("bg-emerald-400/10");
    expect(badge).toHaveClass("text-emerald-400");
  });

  it("should apply warning variant", () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText("Warning");
    expect(badge).toHaveClass("bg-amber-400/10");
    expect(badge).toHaveClass("text-amber-400");
  });

  it("should apply danger variant", () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText("Danger");
    expect(badge).toHaveClass("bg-red-400/10");
    expect(badge).toHaveClass("text-red-400");
  });

  it("should apply info variant", () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText("Info");
    expect(badge).toHaveClass("bg-primary-400/10");
    expect(badge).toHaveClass("text-primary-400");
  });

  it("should apply custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("custom-class");
  });

  it("should forward ref correctly", () => {
    const ref = { current: null };
    render(<Badge ref={ref}>Ref Test</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it("should pass through additional props", () => {
    render(<Badge data-testid="test-badge">Props Test</Badge>);
    expect(screen.getByTestId("test-badge")).toBeInTheDocument();
  });

  it("should have correct base styles", () => {
    render(<Badge>Base Styles</Badge>);
    const badge = screen.getByText("Base Styles");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("rounded-md");
    expect(badge).toHaveClass("text-xs");
    expect(badge).toHaveClass("font-medium");
  });
});
