// =============================================================================
// Header Component Tests
// =============================================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";
import { I18nProvider } from "../../../../../shared/i18n/react";

describe("Header Component", () => {
  const renderWithI18n = () =>
    render(
      <I18nProvider>
        <Header />
      </I18nProvider>,
    );

  it("should render header", () => {
    renderWithI18n();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should display title", () => {
    renderWithI18n();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("should display subtitle", () => {
    renderWithI18n();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("should display environment indicator", () => {
    renderWithI18n();
    expect(screen.getByText("Local Development")).toBeInTheDocument();
  });

  it("should have sticky positioning class", () => {
    renderWithI18n();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky");
    expect(header).toHaveClass("top-0");
  });
});
