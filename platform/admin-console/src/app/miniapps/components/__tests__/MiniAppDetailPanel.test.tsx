import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { MiniAppDetailPanel } from "../MiniAppDetailPanel";
import { PublishRequestDiffPanel } from "../miniapp-detail/PublishRequestDiffPanel";
import type {
  MiniAppPublishAuditVerifyResult,
  MiniAppPublishReminderResult,
  MiniAppPublishRequest,
  MiniAppVersionSummary,
} from "@/lib/hooks/useMiniApps";
import type { VersionDiffEntry } from "@/lib/version-diff";
import type { MiniApp } from "@/types";

const selectedApp: MiniApp = {
  app_id: "miniapp-aa-session-key-lab",
  developer_user_id: "operator",
  manifest_hash: "0xmanifest",
  entry_url: "/miniapps/aa-session-key-lab/index.html",
  developer_pubkey: "0xdeveloper",
  permissions: { wallet: true, oracle: true },
  limits: { daily_gas_cap_per_user: 3, governance_cap: 8 },
  assets_allowed: ["GAS", "NEO"],
  governance_assets_allowed: ["NEO"],
  status: "active",
  created_at: "2026-05-24T12:00:00.000Z",
  updated_at: "2026-05-24T12:00:00.000Z",
  manifest: {
    contracts: [{ name: "SessionKeyPolicy", hash: "0xcontract" }],
    operations: [
      {
        name: "Create Session",
        method: "createSession",
        gas_cost: "0.02",
        description: "Open an AA wallet session key",
      },
    ],
    content: {
      description: "AA wallet session key lab",
      category: "Wallet",
      tags: ["aa", "wallet"],
    },
  },
};

const publishedVersion: MiniAppVersionSummary = {
  id: "version-published",
  app_id: selectedApp.app_id,
  version_no: 7,
  release_channel: "published",
  source_action: "publish",
  status: "active",
  manifest_hash: "0xpublished",
  actor: "operator",
  created_at: "2026-05-24T12:00:00.000Z",
  row_snapshot: { content: { title: "Published" } },
  manifest: { content: { title: "Published" } },
};

const draftVersion: MiniAppVersionSummary = {
  id: "version-draft",
  app_id: selectedApp.app_id,
  version_no: 8,
  release_channel: "draft",
  source_action: "save_draft",
  status: "pending",
  manifest_hash: "0xdraft",
  actor: "operator",
  created_at: "2026-05-24T12:10:00.000Z",
  row_snapshot: { content: { title: "Draft", subtitle: "New copy" } },
  manifest: { content: { title: "Draft", subtitle: "New copy" } },
};

const publishRequest: MiniAppPublishRequest = {
  id: "publish-request-001",
  app_id: selectedApp.app_id,
  requested_version_id: draftVersion.id,
  requested_version_no: draftVersion.version_no,
  requested_manifest_hash: draftVersion.manifest_hash,
  requested_by: "operator",
  request_note: "Promote wallet copy",
  status: "pending",
  review_note: null,
  reviewed_by: null,
  reviewed_at: null,
  applied_version_id: null,
  applied_at: null,
  requested_at: "2026-05-24T12:20:00.000Z",
  updated_at: "2026-05-24T12:20:00.000Z",
  timing: {
    ageMinutes: 18,
    slaMinutes: 15,
    escalationMinutes: 30,
    isSlaBreached: true,
    isEscalated: false,
  },
};

const diffEntries: VersionDiffEntry[] = [
  { path: "content.title", kind: "changed", before: "Published", after: "Draft" },
  { path: "content.subtitle", kind: "added", after: "New copy" },
];

const publishReminderResult: MiniAppPublishReminderResult = {
  success: true,
  sent: 1,
  dry_run: true,
  channel: "webhook",
  reminders: [
    {
      request_id: publishRequest.id,
      app_id: selectedApp.app_id,
      status: "sla_breach",
      age_minutes: 18,
      message: "Pending publish request breached SLA",
    },
  ],
};

const publishAuditVerifyResult: MiniAppPublishAuditVerifyResult = {
  ok: true,
  scanned: 2,
  requests: 1,
  total_events: 2,
  invalid_hash_events: 0,
  chain_break_events: 0,
  table_missing: false,
  generated_at: "2026-05-24T12:30:00.000Z",
  issues: [],
};

function renderDetailPanel() {
  const props = {
    selectedApp,
    onExportJson: vi.fn(),
    onClose: vi.fn(),
    versionChannel: "all" as const,
    onVersionChannelChange: vi.fn(),
    versionError: "",
    versionsQuery: {
      isLoading: false,
      isError: false,
      error: null,
      data: { versions: [draftVersion, publishedVersion] },
    },
    selectedDiffVersion: draftVersion,
    previousDiffVersion: publishedVersion,
    diffScope: "all" as const,
    onDiffScopeChange: vi.fn(),
    diffSummary: { total: 2, added: 1, removed: 0, changed: 1 },
    diffEntries,
    onExportCurrentDiffCsv: vi.fn(),
    onCloseDiff: vi.fn(),
    onSelectDiffVersion: vi.fn(),
    onRollbackVersion: vi.fn(),
    rollbackPending: false,
    publishRequestStatus: "pending" as const,
    onPublishRequestStatusChange: vi.fn(),
    publishReviewError: "",
    publishReminderResult,
    publishAuditVerifyResult,
    publishRequestsQuery: {
      isLoading: false,
      isError: false,
      error: null,
      data: {
        requests: [publishRequest],
        sla: {
          minutes: 15,
          escalation_minutes: 30,
          pending: 1,
          sla_breached: 1,
          escalated: 0,
        },
      },
    },
    onExportPublishRequestsCsv: vi.fn(),
    onVerifyPublishAudit: vi.fn(),
    verifyPublishAuditPending: false,
    onTriggerPublishReminders: vi.fn(),
    triggerPublishRemindersPending: false,
    onViewPublishRequest: vi.fn(),
    onApprovePublishRequest: vi.fn(),
    onRejectPublishRequest: vi.fn(),
    reviewPublishRequestPending: false,
    publishDetailRequestId: publishRequest.id,
    selectedPublishRequest: publishRequest,
    onClosePublishRequestDiff: vi.fn(),
    publishRequestDiffContent: (
      <PublishRequestDiffPanel
        selectedPublishRequest={publishRequest}
        versions={[publishedVersion, draftVersion]}
        publishedVersionId={publishedVersion.id}
      />
    ),
  };

  const renderResult = render(<MiniAppDetailPanel {...props} />);
  return { ...props, ...renderResult };
}

describe("MiniAppDetailPanel", () => {
  it("keeps the detail, version, and publish review surfaces on the light admin chrome", () => {
    const { container } = renderDetailPanel();
    const html = container.innerHTML;
    const panel = container.querySelector(".miniapp-detail-panel");
    const summary = screen.getByLabelText("MiniApp detail summary");

    expect(panel).toBeInstanceOf(HTMLElement);
    expect((panel as HTMLElement).className).toContain("rounded-xl");
    expect((panel as HTMLElement).className).toContain(
      "miniapp-detail-shell",
    );
    expect((panel as HTMLElement).className).not.toContain("glass-card");
    expect(screen.getByText(selectedApp.app_id)).toBeInTheDocument();
    expect(summary).toHaveTextContent("Status");
    expect(summary).toHaveTextContent("active");
    expect(summary).toHaveTextContent("Permissions");
    expect(summary).toHaveTextContent("wallet, oracle");
    expect(summary).toHaveTextContent("Entry");
    expect(summary).toHaveTextContent("/miniapps/aa-session-key-lab/index.html");
    expect(screen.getByText("Version History")).toBeInTheDocument();
    expect(screen.getByText("Publish Requests")).toBeInTheDocument();
    expect(screen.getByText(/Request Diff:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflow" }).className).toContain(
      "rounded-xl",
    );

    for (const token of [
      "dark:",
      "rounded-md",
      "rounded-2xl",
      "bg-white/80",
      "bg-white/70",
      "disabled:opacity-50",
      "blur-",
      "hover:-translate-y-1",
      "shadow-lg",
    ]) {
      expect(html, `detail panel should not include ${token}`).not.toContain(
        token,
      );
    }
  });

  it("keeps version and publish review controls wired to their callbacks", () => {
    const props = renderDetailPanel();

    fireEvent.change(screen.getByLabelText("Version channel filter"), {
      target: { value: "published" },
    });
    fireEvent.change(screen.getByLabelText("Diff scope"), {
      target: { value: "manifest" },
    });
    fireEvent.change(screen.getByLabelText("Publish request status filter"), {
      target: { value: "approved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Audit Chain" }));
    fireEvent.click(screen.getByRole("button", { name: "Dry-Run Remind" }));
    fireEvent.click(screen.getByRole("button", { name: "Send Reminders" }));
    fireEvent.click(screen.getByRole("button", { name: "View Diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(props.onVersionChannelChange).toHaveBeenCalledWith("published");
    expect(props.onDiffScopeChange).toHaveBeenCalledWith("manifest");
    expect(props.onPublishRequestStatusChange).toHaveBeenCalledWith("approved");
    expect(props.onVerifyPublishAudit).toHaveBeenCalledTimes(1);
    expect(props.onTriggerPublishReminders).toHaveBeenCalledWith(true);
    expect(props.onTriggerPublishReminders).toHaveBeenCalledWith(false);
    expect(props.onViewPublishRequest).toHaveBeenCalledWith(publishRequest.id);
    expect(props.onApprovePublishRequest).toHaveBeenCalledWith(publishRequest);
    expect(props.onRejectPublishRequest).toHaveBeenCalledWith(publishRequest);
  });

  it("keeps the source free of deprecated glass detail styling", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../MiniAppDetailPanel.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/variant="glass"|glass-card|backdrop-blur/);
  });
});
