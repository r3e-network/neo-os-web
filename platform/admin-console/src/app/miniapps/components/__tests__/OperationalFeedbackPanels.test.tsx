import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { BatchResultPanels } from "../BatchResultPanels";
import { LiveSmokeReportsCard } from "../LiveSmokeReportsCard";
import type {
  MiniAppBatchImportResult,
  MiniAppBatchRollbackResult,
} from "@/lib/hooks/useMiniApps";

const report = {
  runId: "live-smoke-20260524T120000Z",
  generatedAt: "2026-05-24T12:00:00.000Z",
  flagshipStatus: 0,
  selectedStatus: 1,
  flagshipCounts: { pass: 7, fail: 0, skipped: 1 },
  selectedCounts: { pass: 12, fail: 1, skipped: 0 },
  summaryPath: "docs/reports/live-smoke/summary.json",
  warnings: ["selected lane failed one app"],
};

const batchImportResult: MiniAppBatchImportResult = {
  success: false,
  dry_run: false,
  stop_on_error: false,
  summary: { total: 2, imported: 1, validated: 0, failed: 1 },
  results: [
    {
      index: 0,
      file_name: "miniapp-aa-session-key-lab.json",
      app_id: "miniapp-aa-session-key-lab",
      status: "imported",
      mode: "update",
      action: "save_draft",
      version: { version_no: 8, release_channel: "draft" },
    },
    {
      index: 1,
      file_name: "miniapp-oracle-price-console.json",
      app_id: "miniapp-oracle-price-console",
      status: "failed",
      mode: "update",
      action: "publish",
      error: "Invalid manifest hash",
    },
  ],
  rollback_plan: {
    import_batch_id: "batch-001",
    generated_at: "2026-05-24T12:00:00.000Z",
    targets: [],
  },
};

const batchRollbackResult: MiniAppBatchRollbackResult = {
  success: true,
  summary: {
    total: 1,
    failed: 0,
    rolled_back: 1,
    disabled_created_app: 0,
    noop: 0,
  },
  results: [
    {
      app_id: "miniapp-aa-session-key-lab",
      status: "rolled_back",
      detail: "restored version #7",
    },
  ],
};

const legacyTokens = [
  "dark:",
  "rounded-md",
  "bg-white/70",
  "bg-white/80",
  "backdrop-blur",
  "disabled:opacity-50",
  "shadow-lg",
];

describe("LiveSmokeReportsCard", () => {
  it("renders live validation summaries with compact light report rows", () => {
    const { container } = render(
      <LiveSmokeReportsCard
        adminReady
        reports={[report]}
        loading={false}
        error=""
      />,
    );

    const card = container.querySelector(".live-smoke-reports-card");
    const row = container.querySelector(".live-smoke-report-row");

    expect(card).toBeInstanceOf(HTMLElement);
    expect(row).toBeInstanceOf(HTMLElement);
    expect((card as HTMLElement).className).toContain(
      "live-smoke-reports-shell",
    );
    expect((card as HTMLElement).className).not.toContain("glass-card");
    expect((row as HTMLElement).className).toContain("bg-white");
    expect(screen.getByText("Flagship OK")).toBeInTheDocument();
    expect(screen.getByText("Selected Needs Review")).toBeInTheDocument();
    expect(screen.getByText(/selected lane failed one app/)).toBeInTheDocument();

    for (const token of legacyTokens) {
      expect(container.innerHTML, `live smoke card should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});

describe("BatchResultPanels", () => {
  it("keeps import and rollback feedback on the shared light table surface", () => {
    const { container } = render(
      <BatchResultPanels
        batchImportResult={batchImportResult}
        batchRollbackResult={batchRollbackResult}
      />,
    );

    const importCard = container.querySelector(".batch-import-result-card");
    const rollbackCard = container.querySelector(".batch-rollback-result-card");

    expect(importCard).toBeInstanceOf(HTMLElement);
    expect(rollbackCard).toBeInstanceOf(HTMLElement);
    expect((importCard as HTMLElement).className).toContain(
      "batch-import-result-shell",
    );
    expect((rollbackCard as HTMLElement).className).toContain(
      "batch-rollback-result-shell",
    );
    expect((importCard as HTMLElement).className).not.toContain("glass-card");
    expect((rollbackCard as HTMLElement).className).not.toContain("glass-card");
    expect(screen.getByLabelText("Batch import summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Batch rollback summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Batch import result rows")).toBeInTheDocument();
    expect(screen.getByLabelText("Batch rollback result rows")).toBeInTheDocument();
    expect(screen.getByText("Invalid manifest hash")).toBeInTheDocument();

    for (const token of legacyTokens) {
      expect(container.innerHTML, `batch result panels should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});

describe("Operational feedback source contracts", () => {
  it("keeps operational panels free of deprecated glass card styling", () => {
    for (const sourceFile of [
      "../LiveSmokeReportsCard.tsx",
      "../BatchResultPanels.tsx",
    ]) {
      const source = fs.readFileSync(
        path.resolve(__dirname, sourceFile),
        "utf8",
      );

      expect(source).not.toMatch(/variant="glass"|glass-card|backdrop-blur/);
    }
  });
});
