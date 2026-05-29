import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import UsersPage from "../page";

const usersHookMocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  useSearchUsers: vi.fn(),
}));

vi.mock("@/lib/hooks/useUsers", () => ({
  useUsers: usersHookMocks.useUsers,
  useSearchUsers: usersHookMocks.useSearchUsers,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleUsers = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    address: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    email: "operator@example.com",
    created_at: "2026-05-20T08:00:00Z",
    updated_at: "2026-05-25T09:30:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    address: "NQ8uR7uP5G1bMNwFQSjRRnWB7EVVQWjzS9",
    email: "",
    created_at: "2026-05-18T08:00:00Z",
    updated_at: "2026-05-22T09:30:00Z",
  },
];

const searchUsers = [sampleUsers[0]];

function mockUsers(overrides = {}) {
  usersHookMocks.useUsers.mockReturnValue({
    data: sampleUsers,
    isLoading: false,
    error: null,
    ...overrides,
  });
  usersHookMocks.useSearchUsers.mockImplementation((term: string) => ({
    data: term ? searchUsers : [],
    isLoading: false,
    error: null,
  }));
}

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers();
  });

  it("renders a light user operations dashboard with compact summary cards", () => {
    const { container } = render(<UsersPage />);

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    const summary = screen.getByLabelText("User directory summary");
    expect(summary).toHaveClass("users-summary-grid");
    expect(summary).toHaveTextContent("Visible Users");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Email Coverage");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Search Mode");
    expect(summary).toHaveTextContent("All users");

    const management = screen.getByLabelText("User management panel");
    expect(management).toHaveClass("users-management-card");
    expect(management).toHaveTextContent("User Directory");
    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[/,
    );
  });

  it("provides mobile user cards while keeping the desktop table available", () => {
    const { container } = render(<UsersPage />);

    const mobileList = screen.getByLabelText("Mobile users list");
    expect(mobileList).toHaveClass("users-mobile-list");
    expect(mobileList).toHaveClass("md:hidden");
    expect(mobileList).toHaveTextContent("operator@example.com");
    expect(mobileList).toHaveTextContent("No email on file");
    expect(mobileList).toHaveTextContent("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq");
    expect(mobileList).toHaveTextContent("Created");
    expect(mobileList).toHaveTextContent("Updated");
    expect(container.querySelector(".users-desktop-table")).toHaveClass(
      "hidden",
      "md:block",
    );
  });

  it("passes the search term into the search hook and updates visible results", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.type(screen.getByLabelText("Search users"), "NXV7");

    expect(usersHookMocks.useSearchUsers).toHaveBeenLastCalledWith("NXV7");
    expect(screen.getByLabelText("User directory summary")).toHaveTextContent(
      "Search active",
    );
    expect(screen.getByText("Showing 1 result for NXV7")).toBeInTheDocument();
  });

  it("shows a friendly load error instead of rendering stale rows", () => {
    mockUsers({
      data: undefined,
      error: new Error("Unauthorized"),
    });

    render(<UsersPage />);

    expect(
      screen.getByRole("alert", { name: "User directory could not be loaded" }),
    ).toHaveTextContent("User directory could not be loaded");
    expect(screen.queryByText("operator@example.com")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow user-management tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
