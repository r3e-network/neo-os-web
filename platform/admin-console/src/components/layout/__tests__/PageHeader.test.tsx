import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders shared route titles and actions", () => {
    render(
      <PageHeader
        title="Price Feeds"
        description="Oracle feed health"
        actions={<button type="button">Refresh</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Price Feeds" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Oracle feed health")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("keeps shared route headers compact, light, and free of glow effects", () => {
    const { container } = render(
      <PageHeader
        title="Oracle Secrets"
        description="Credential operations"
        highlightLastWord
      />,
    );

    const header = container.querySelector(".admin-page-header");
    expect(header).toBeInstanceOf(HTMLElement);
    expect((header as HTMLElement).className).toContain("gap-2");

    for (const token of [
      "dark:",
      "drop-shadow",
      "text-neo",
      "text-3xl",
      "tracking-[",
    ]) {
      expect(container.innerHTML, `page header should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});
