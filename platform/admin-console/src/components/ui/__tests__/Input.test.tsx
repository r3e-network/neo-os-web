// =============================================================================
// Input Component Tests
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../Input";

describe("Input Component", () => {
  it("should render input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("should render with label", () => {
    render(<Input label="Username" id="username" />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("should render error message", () => {
    render(<Input error="This field is required" id="test-input" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("should apply error styles when error is present", () => {
    render(<Input error="Error" id="error-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-danger-500");
  });

  it("should handle value changes", () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Type here" />);
    const input = screen.getByPlaceholderText("Type here");
    fireEvent.change(input, { target: { value: "test" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });

  it("should forward ref correctly", () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("should apply custom className", () => {
    render(<Input className="custom-input" id="custom" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom-input");
  });

  it("should render with different types", () => {
    render(<Input type="password" placeholder="Password" />);
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("should have correct base styles", () => {
    render(<Input id="styled-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("rounded-xl");
  });

  it("uses light operator-console field chrome without local dark-mode forks", () => {
    render(
      <Input
        id="operator-input"
        label="Operator field"
        placeholder="Value"
        disabled
        error="Use a valid value"
      />,
    );
    const input = screen.getByLabelText("Operator field");
    const error = screen.getByText("Use a valid value");
    const fieldMarkup = input.closest("div")?.innerHTML ?? "";

    expect(fieldMarkup).not.toContain("dark:");
    expect(input.className).not.toContain("disabled:opacity-50");
    expect(input).toHaveClass("rounded-xl", "border", "border-danger-500");
    expect(input).toHaveClass("disabled:opacity-100");
    expect(error).toHaveClass("text-danger-600");
  });

  it("should set aria-invalid when error is present", () => {
    render(<Input error="Error" id="aria-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("should not set aria-invalid when no error", () => {
    render(<Input id="no-error-input" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
});
