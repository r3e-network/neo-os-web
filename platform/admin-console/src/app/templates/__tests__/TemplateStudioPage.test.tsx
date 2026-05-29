import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import TemplateStudioPage from "../page";

const pushMock = vi.fn();

const templateHookMocks = vi.hoisted(() => ({
  useTemplateMarketTemplates: vi.fn(),
  useTemplateMarketRequests: vi.fn(),
  useUpsertTemplateMarketEntry: vi.fn(),
  useReviewTemplateMarketRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/hooks/useMiniApps", () => ({
  useTemplateMarketTemplates: templateHookMocks.useTemplateMarketTemplates,
  useTemplateMarketRequests: templateHookMocks.useTemplateMarketRequests,
  useUpsertTemplateMarketEntry: templateHookMocks.useUpsertTemplateMarketEntry,
  useReviewTemplateMarketRequest: templateHookMocks.useReviewTemplateMarketRequest,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const templates = [
  {
    row_id: "tpl-row-1",
    template_kind: "frontend",
    template_id: "oracle.price.console",
    version: "1.0.0",
    owner_user_id: null,
    name: "Oracle Price Console",
    description: "A polished price feed surface for MiniApp builders.",
    category: "data",
    source_type: "verified",
    tags: ["oracle", "pricefeed"],
    is_active: true,
    is_verified: true,
    usage_count: 42,
    rating_avg: 4.8,
    rating_count: 8,
    schema: {},
    ui_schema: {},
    manifest: {
      frontend_template: {
        template_id: "oracle.price.console",
        version: "1.0.0",
      },
    },
    factory_template_ref: null,
    updated_at: "2026-05-26T05:50:00Z",
  },
  {
    row_id: "tpl-row-2",
    template_kind: "contract",
    template_id: "escrow.factory.v2",
    version: "2.1.0",
    owner_user_id: null,
    name: "Escrow Factory",
    description: "Contract starter with auditable factory settings.",
    category: "defi",
    source_type: "community",
    tags: ["factory"],
    is_active: false,
    is_verified: false,
    usage_count: 6,
    rating_avg: null,
    rating_count: 0,
    schema: {},
    ui_schema: {},
    manifest: {
      contract_template: {
        template_id: "escrow.factory.v2",
        version: "2.1.0",
      },
    },
    factory_template_ref: "factory.escrow.v2",
    updated_at: "2026-05-25T05:50:00Z",
  },
];

const requests = [
  {
    id: "request-12345678",
    template_kind: "contract",
    template_row_id: "tpl-row-2",
    status: "pending",
    requested_by: "operator",
    reviewed_by: null,
    review_note: null,
    created_at: "2026-05-26T06:00:00Z",
    reviewed_at: null,
  },
];

function mockTemplateStudio(overrides = {}) {
  templateHookMocks.useTemplateMarketTemplates.mockReturnValue({
    data: { mode: "templates", templates },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  });
  templateHookMocks.useTemplateMarketRequests.mockReturnValue({
    data: { mode: "requests", requests },
    isLoading: false,
    isError: false,
    error: null,
  });
  templateHookMocks.useUpsertTemplateMarketEntry.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  templateHookMocks.useReviewTemplateMarketRequest.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
}

describe("TemplateStudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
    mockTemplateStudio();
  });

  it("renders a light Template Studio workspace with operational summary", () => {
    const { container } = render(<TemplateStudioPage />);

    expect(
      screen.getByRole("heading", { name: "Template Studio" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Template Studio operations summary");
    expect(summary).toHaveClass("template-studio-summary-grid");
    expect(summary).toHaveTextContent("Marketplace");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Verified");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Pending Requests");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Active Templates");
    expect(summary).toHaveTextContent("1/2");

    const filters = screen.getByLabelText("Template Studio controls");
    expect(filters).toHaveClass("template-studio-filters-card");
    expect(screen.getByLabelText("Template marketplace panel")).toHaveClass(
      "template-marketplace-card",
    );
    expect(screen.getByLabelText("Template detail panel")).toHaveClass(
      "template-detail-card",
    );

    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[|drop-shadow/,
    );
  });

  it("lets operators inspect a template and load it into the editor", async () => {
    const user = userEvent.setup();
    render(<TemplateStudioPage />);

    await user.click(
      screen.getByRole("button", { name: /Oracle Price Console/ }),
    );

    const detail = screen.getByLabelText("Template detail panel");
    expect(detail).toHaveTextContent("oracle.price.console");
    expect(detail).toHaveTextContent("A polished price feed surface");

    await user.click(screen.getByRole("button", { name: "Load Into Editor" }));

    expect(screen.getByLabelText("Template ID")).toHaveValue(
      "oracle.price.console",
    );
    expect(screen.getByText(/Loaded oracle.price.console@1.0.0/)).toBeVisible();
  });

  it("keeps data failures friendly and does not render stale marketplace rows", () => {
    mockTemplateStudio({
      data: undefined,
      isError: true,
      error: new Error("Unauthorized"),
    });

    render(<TemplateStudioPage />);

    expect(
      screen.getByRole("alert", {
        name: "Template marketplace could not be loaded",
      }),
    ).toHaveTextContent("Template marketplace could not be loaded");
    expect(screen.queryByText("Oracle Price Console")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow Template Studio tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
