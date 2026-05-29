import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../Tabs";

const tabs = [
  { label: "Basic", value: "basic" },
  { label: "Content", value: "content" },
  { label: "Contracts", value: "contracts" },
];

describe("Tabs Component", () => {
  it("renders accessible tabs and supports keyboard navigation", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="basic" onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Basic" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Basic" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("content");
  });

  it("uses compact light operator-console tabs without local dark-mode forks", () => {
    const { container } = render(
      <Tabs tabs={tabs} value="content" onChange={vi.fn()} />,
    );
    const tablist = screen.getByRole("tablist");
    const activeTab = screen.getByRole("tab", { name: "Content" });
    const inactiveTab = screen.getByRole("tab", { name: "Contracts" });

    expect(container.innerHTML).not.toContain("dark:");
    expect(tablist).toHaveClass("rounded-xl", "border", "border-gray-200");
    expect(tablist.className).not.toContain("border-b");
    expect(activeTab).toHaveClass("bg-gray-900", "text-white");
    expect(inactiveTab).toHaveClass("text-gray-600");
    expect(inactiveTab.className).not.toContain("hover:border-gray-300");
  });
});
